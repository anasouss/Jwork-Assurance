package com.assurance.service;

import com.assurance.dto.request.ConfigurationImportReleveBancaireRequest;
import com.assurance.dto.request.EnregistrerRapprochementsBancairesRequest;
import com.assurance.dto.response.ImportReleveBancaireResponse;
import com.assurance.dto.response.PageMetadata;
import com.assurance.dto.response.PagedResponse;
import com.assurance.dto.response.ProfilImportReleveBancaireResponse;
import com.assurance.entity.CompteTresorerie;
import com.assurance.entity.ImportReleveBancaire;
import com.assurance.entity.InstrumentReglementClient;
import com.assurance.entity.LigneReleveBancaire;
import com.assurance.entity.MouvementTresorerie;
import com.assurance.entity.ProfilImportReleveBancaire;
import com.assurance.entity.RapprochementBancaire;
import com.assurance.enums.FormatReleveBancaire;
import com.assurance.enums.StatutImportReleveBancaire;
import com.assurance.enums.StatutInstrumentReglement;
import com.assurance.enums.StatutLigneReleveBancaire;
import com.assurance.enums.StatutRapprochementBancaire;
import com.assurance.enums.TypeCompteTresorerie;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.ImportReleveBancaireRepository;
import com.assurance.repository.InstrumentReglementClientRepository;
import com.assurance.repository.LigneReleveBancaireRepository;
import com.assurance.repository.ProfilImportReleveBancaireRepository;
import com.assurance.repository.RapprochementBancaireRepository;
import com.assurance.security.TenantContext;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ReleveBancaireService {

    private static final long MAX_FILE_SIZE = 30L * 1024L * 1024L;
    private static final BigDecimal ZERO = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
    private static final Set<StatutRapprochementBancaire> ACTIVE_RECONCILIATION_STATUSES = Set.of(
            StatutRapprochementBancaire.SELECTIONNE,
            StatutRapprochementBancaire.VALIDE
    );

    private final ReleveBancaireParserService parserService;
    private final ImportReleveBancaireRepository importRepository;
    private final LigneReleveBancaireRepository lineRepository;
    private final RapprochementBancaireRepository reconciliationRepository;
    private final ProfilImportReleveBancaireRepository profileRepository;
    private final InstrumentReglementClientRepository instrumentRepository;
    private final TresorerieService tresorerieService;
    private final ReglementClientService reglementClientService;
    private final StorageLayoutService storageLayoutService;
    private final ObjectMapper objectMapper;
    private final EntityManager entityManager;

    public ImportReleveBancaireResponse preview(
            MultipartFile file,
            ConfigurationImportReleveBancaireRequest configuration
    ) {
        validateFile(file);
        FormatReleveBancaire format = detectFormat(file.getOriginalFilename());
        Path temporary = null;
        try {
            temporary = Files.createTempFile("bank-statement-preview-", extension(format));
            Files.copy(file.getInputStream(), temporary, StandardCopyOption.REPLACE_EXISTING);
            ReleveBancaireParserService.ParseResult parsed = parserService.parse(
                    temporary,
                    format,
                    configuration
            );
            return previewResponse(file.getOriginalFilename(), format, parsed);
        } catch (IOException error) {
            throw new BadRequestException("Le relevé bancaire ne peut pas être prévisualisé");
        } finally {
            deleteQuietly(temporary);
        }
    }

    @Transactional
    public ImportReleveBancaireResponse confirmImport(
            Long agenceId,
            Long accountId,
            Long profileId,
            MultipartFile file,
            ConfigurationImportReleveBancaireRequest configuration
    ) {
        validateFile(file);
        CompteTresorerie account = requireBankAccount(agenceId, accountId);
        FormatReleveBancaire format = detectFormat(file.getOriginalFilename());
        ConfigurationImportReleveBancaireRequest effective = configuration;
        ProfilImportReleveBancaire selectedProfile = profileId == null
                ? null
                : requireProfile(agenceId, accountId, profileId, format);
        Path temporary = null;
        Path storedFile = null;
        try {
            byte[] bytes = file.getBytes();
            String hash = sha256(bytes);
            if (importRepository.existsByAgenceIdAndCompteTresorerieIdAndSha256(
                    agenceId,
                    accountId,
                    hash
            )) {
                throw new BadRequestException("Ce relevé a déjà été importé pour ce compte bancaire");
            }
            temporary = Files.createTempFile("bank-statement-import-", extension(format));
            Files.write(temporary, bytes);
            ReleveBancaireParserService.ParseResult parsed = parserService.parse(
                    temporary,
                    format,
                    effective
            );
            if (!parsed.complete()) {
                throw new BadRequestException(
                        "Associez au minimum la date, le libellé et le montant avant de confirmer l’import"
                );
            }
            if (parsed.lines().isEmpty()) {
                throw new BadRequestException("Le relevé ne contient aucune opération exploitable");
            }

            Path storageKey = storageKey(agenceId, accountId, file.getOriginalFilename(), format);
            storedFile = storageLayoutService.resolveBankStatement(storageKey);
            Files.createDirectories(storedFile.getParent());
            Files.write(storedFile, bytes);

            ProfilImportReleveBancaire savedProfile = saveProfileIfRequested(
                    agenceId,
                    account,
                    format,
                    parsed.configuration()
            );
            ProfilImportReleveBancaire profile = savedProfile == null
                    ? selectedProfile
                    : savedProfile;
            ImportReleveBancaire imported = ImportReleveBancaire.builder()
                    .agence(account.getAgence())
                    .compteTresorerie(account)
                    .profilImport(profile)
                    .nomFichier(safeOriginalName(file.getOriginalFilename(), format))
                    .cleStockage(storageKey.toString().replace('\\', '/'))
                    .typeContenu(file.getContentType())
                    .sha256(hash)
                    .format(format)
                    .statut(StatutImportReleveBancaire.BROUILLON)
                    .configurationJson(writeJson(parsed.configuration()))
                    .entetesJson(writeJson(parsed.headers()))
                    .soldeOuverture(parsed.openingBalance())
                    .soldeCloture(parsed.closingBalance())
                    .totalDebits(sum(parsed.lines(), ReleveBancaireParserService.NormalizedLine::debit))
                    .totalCredits(sum(parsed.lines(), ReleveBancaireParserService.NormalizedLine::credit))
                    .nombreLignes(parsed.lines().size())
                    .build();
            for (ReleveBancaireParserService.NormalizedLine source : parsed.lines()) {
                imported.getLignes().add(toEntity(imported, source));
            }
            imported = importRepository.saveAndFlush(imported);
            return detail(agenceId, imported.getId());
        } catch (IOException error) {
            deleteQuietly(storedFile);
            throw new BadRequestException("Le relevé bancaire ne peut pas être enregistré");
        } catch (RuntimeException error) {
            deleteQuietly(storedFile);
            throw error;
        } finally {
            deleteQuietly(temporary);
        }
    }

    @Transactional(readOnly = true)
    public PagedResponse<ImportReleveBancaireResponse> list(
            Long agenceId,
            Long accountId,
            int page,
            int size
    ) {
        requireBankAccount(agenceId, accountId);
        Page<ImportReleveBancaire> result = importRepository
                .findByAgenceIdAndCompteTresorerieIdOrderByCreatedAtDesc(
                        agenceId,
                        accountId,
                        PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100))
                );
        return PagedResponse.<ImportReleveBancaireResponse>builder()
                .items(result.getContent().stream().map(this::summaryResponse).toList())
                .page(PageMetadata.from(result))
                .build();
    }

    @Transactional(readOnly = true)
    public List<ProfilImportReleveBancaireResponse> profiles(Long agenceId, Long accountId) {
        requireBankAccount(agenceId, accountId);
        return profileRepository
                .findByAgenceIdAndCompteTresorerieIdAndActifTrueOrderByNomAsc(agenceId, accountId)
                .stream()
                .map(profile -> ProfilImportReleveBancaireResponse.builder()
                        .id(profile.getId())
                        .compteTresorerieId(profile.getCompteTresorerie().getId())
                        .nom(profile.getNom())
                        .format(profile.getFormat())
                        .configuration(readConfiguration(profile.getConfigurationJson()))
                        .build())
                .toList();
    }

    @Transactional(readOnly = true)
    public ImportReleveBancaireResponse detail(Long agenceId, Long importId) {
        ImportReleveBancaire imported = findImport(agenceId, importId);
        List<LigneReleveBancaire> lines = lineRepository
                .findByImportReleveIdOrderByNumeroLigneAsc(importId);
        List<InstrumentReglementClient> pending = instrumentRepository
                .findByAgenceIdAndStatutOrderByDateEcheanceAscIdAsc(
                        agenceId,
                        StatutInstrumentReglement.EN_ATTENTE
                );
        return detailResponse(imported, lines, pending);
    }

    @Transactional
    public ImportReleveBancaireResponse saveReconciliations(
            Long agenceId,
            Long importId,
            EnregistrerRapprochementsBancairesRequest request
    ) {
        ImportReleveBancaire imported = findEditableImport(agenceId, importId);
        reconciliationRepository.deleteByLigneReleveImportReleveIdAndStatut(
                importId,
                StatutRapprochementBancaire.SELECTIONNE
        );
        reconciliationRepository.flush();
        entityManager.clear();
        imported = findEditableImport(agenceId, importId);
        List<LigneReleveBancaire> lines = lineRepository
                .findByImportReleveIdOrderByNumeroLigneAsc(importId);
        Map<Long, LigneReleveBancaire> linesById = lines.stream()
                .collect(Collectors.toMap(LigneReleveBancaire::getId, Function.identity()));
        List<Long> ignoredLineIds = request.getLignesIgnorees() == null
                ? List.of()
                : request.getLignesIgnorees();
        List<EnregistrerRapprochementsBancairesRequest.Selection> selections =
                request.getSelections() == null ? List.of() : request.getSelections();
        Set<Long> ignoredIds = Set.copyOf(ignoredLineIds);
        if (!linesById.keySet().containsAll(ignoredIds)) {
            throw new BadRequestException("Une ligne ignorée n’appartient pas à ce relevé");
        }

        lines.forEach(line -> {
            boolean hasValidated = line.getRapprochements().stream().anyMatch(reconciliation ->
                    reconciliation.getStatut() == StatutRapprochementBancaire.VALIDE);
            if (!hasValidated) {
                line.setStatut(ignoredIds.contains(line.getId())
                        ? StatutLigneReleveBancaire.IGNOREE
                        : StatutLigneReleveBancaire.NON_RAPPROCHEE);
            }
        });

        List<Long> instrumentIds = selections.stream()
                .map(EnregistrerRapprochementsBancairesRequest.Selection::getInstrumentId)
                .distinct()
                .toList();
        Map<Long, InstrumentReglementClient> instruments = instrumentRepository.findAllById(instrumentIds)
                .stream()
                .filter(instrument -> agenceId.equals(instrument.getAgence().getId()))
                .collect(Collectors.toMap(InstrumentReglementClient::getId, Function.identity()));
        if (instruments.size() != instrumentIds.size()) {
            throw new BadRequestException("Un moyen de règlement sélectionné est introuvable");
        }

        Map<Long, BigDecimal> selectedByLine = new LinkedHashMap<>();
        Map<Long, BigDecimal> selectedByInstrument = new LinkedHashMap<>();
        List<RapprochementBancaire> reconciliations = new ArrayList<>();
        Set<String> uniquePairs = new java.util.HashSet<>();
        for (EnregistrerRapprochementsBancairesRequest.Selection selection : selections) {
            LigneReleveBancaire line = linesById.get(selection.getLigneId());
            InstrumentReglementClient instrument = instruments.get(selection.getInstrumentId());
            if (line == null) {
                throw new BadRequestException("Une ligne sélectionnée n’appartient pas à ce relevé");
            }
            validateInstrumentForAccount(instrument, imported.getCompteTresorerie());
            if (line.getCredit().signum() <= 0) {
                throw new BadRequestException("Seules les entrées bancaires peuvent confirmer un encaissement client");
            }
            String pair = line.getId() + ":" + instrument.getId();
            if (!uniquePairs.add(pair)) {
                throw new BadRequestException("Une correspondance a été sélectionnée plusieurs fois");
            }
            BigDecimal amount = money(selection.getMontant());
            selectedByLine.merge(line.getId(), amount, BigDecimal::add);
            selectedByInstrument.merge(instrument.getId(), amount, BigDecimal::add);
            MatchScore score = score(line, instrument, imported.getCompteTresorerie());
            reconciliations.add(RapprochementBancaire.builder()
                    .ligneReleve(line)
                    .instrumentReglement(instrument)
                    .montant(amount)
                    .scoreCorrespondance(score.value())
                    .motifCorrespondance(score.reason())
                    .statut(StatutRapprochementBancaire.SELECTIONNE)
                    .build());
        }
        selectedByLine.forEach((lineId, amount) -> {
            LigneReleveBancaire line = linesById.get(lineId);
            if (amount.compareTo(money(line.getCredit())) > 0) {
                throw new BadRequestException("Le montant rapproché dépasse le crédit de la ligne "
                        + line.getNumeroLigne());
            }
            line.setStatut(StatutLigneReleveBancaire.SUGGEREE);
        });
        selectedByInstrument.forEach((instrumentId, amount) -> {
            InstrumentReglementClient instrument = instruments.get(instrumentId);
            BigDecimal previouslyValidated = reconciliationRepository.sumByInstrumentAndStatuses(
                    instrumentId,
                    Set.of(StatutRapprochementBancaire.VALIDE)
            );
            if (money(previouslyValidated).add(amount).compareTo(money(instrument.getMontant())) > 0) {
                throw new BadRequestException("Le rapprochement dépasse le montant du moyen de règlement "
                        + instrument.getReglement().getNumero());
            }
        });
        lineRepository.saveAll(lines);
        reconciliationRepository.saveAll(reconciliations);
        entityManager.flush();
        entityManager.clear();
        return detail(agenceId, importId);
    }

    @Transactional
    public ImportReleveBancaireResponse validate(Long agenceId, Long importId) {
        ImportReleveBancaire imported = findEditableImport(agenceId, importId);
        List<RapprochementBancaire> selected = reconciliationRepository
                .findByLigneReleveImportReleveIdAndStatutOrderByIdAsc(
                        importId,
                        StatutRapprochementBancaire.SELECTIONNE
                );
        Map<Long, BigDecimal> selectedByLine = selected.stream()
                .collect(Collectors.groupingBy(
                        reconciliation -> reconciliation.getLigneReleve().getId(),
                        Collectors.reducing(
                                ZERO,
                                RapprochementBancaire::getMontant,
                                BigDecimal::add
                        )
                ));
        List<LigneReleveBancaire> statementLines = lineRepository
                .findByImportReleveIdOrderByNumeroLigneAsc(importId);
        for (LigneReleveBancaire line : statementLines) {
            if (money(line.getCredit()).signum() <= 0
                    || line.getStatut() == StatutLigneReleveBancaire.IGNOREE) {
                continue;
            }
            BigDecimal matchedAmount = money(selectedByLine.get(line.getId()));
            if (matchedAmount.compareTo(money(line.getCredit())) != 0) {
                throw new BadRequestException(
                        "La ligne bancaire " + line.getNumeroLigne()
                                + " doit être entièrement rapprochée ou explicitement ignorée"
                );
            }
        }
        Map<Long, List<RapprochementBancaire>> byInstrument = selected.stream()
                .collect(Collectors.groupingBy(
                        reconciliation -> reconciliation.getInstrumentReglement().getId(),
                        LinkedHashMap::new,
                        Collectors.toList()
                ));
        for (List<RapprochementBancaire> group : byInstrument.values()) {
            InstrumentReglementClient instrument = group.get(0).getInstrumentReglement();
            validateInstrumentForAccount(instrument, imported.getCompteTresorerie());
            BigDecimal selectedAmount = group.stream()
                    .map(RapprochementBancaire::getMontant)
                    .reduce(ZERO, BigDecimal::add);
            BigDecimal validatedAmount = reconciliationRepository.sumByInstrumentAndStatuses(
                    instrument.getId(),
                    Set.of(StatutRapprochementBancaire.VALIDE)
            );
            if (money(validatedAmount).add(selectedAmount)
                    .compareTo(money(instrument.getMontant())) != 0) {
                throw new BadRequestException(
                        "Le moyen de règlement " + instrument.getReglement().getNumero()
                                + " doit être rapproché pour son montant complet avant validation"
                );
            }
            LigneReleveBancaire singleEvidence = group.size() == 1
                    ? group.get(0).getLigneReleve()
                    : null;
            MouvementTresorerie movement = reglementClientService.confirmInstrumentFromBankStatement(
                    agenceId,
                    instrument.getId(),
                    imported.getCompteTresorerie().getId(),
                    group.stream()
                            .map(row -> row.getLigneReleve().getDateOperation())
                            .max(LocalDate::compareTo)
                            .orElse(LocalDate.now()),
                    singleEvidence
            );
            for (RapprochementBancaire reconciliation : group) {
                reconciliation.setStatut(StatutRapprochementBancaire.VALIDE);
                reconciliation.setValideLe(LocalDateTime.now());
                reconciliation.setValideParUserId(TenantContext.getCurrentUser());
                reconciliation.setMouvementTresorerie(movement);
            }
        }
        reconciliationRepository.saveAll(selected);
        Map<Long, BigDecimal> validatedByLine = selected.stream()
                .collect(Collectors.groupingBy(
                        reconciliation -> reconciliation.getLigneReleve().getId(),
                        Collectors.reducing(
                                ZERO,
                                RapprochementBancaire::getMontant,
                                BigDecimal::add
                        )
                ));
        for (LigneReleveBancaire line : statementLines) {
            BigDecimal amount = money(validatedByLine.get(line.getId()));
            if (amount.signum() > 0) {
                line.setStatut(amount.compareTo(money(line.getCredit())) == 0
                        ? StatutLigneReleveBancaire.RAPPROCHEE
                        : StatutLigneReleveBancaire.PARTIELLEMENT_RAPPROCHEE);
            }
        }
        lineRepository.saveAll(statementLines);
        imported.setStatut(StatutImportReleveBancaire.VALIDE);
        imported.setValideLe(LocalDateTime.now());
        imported.setValideParUserId(TenantContext.getCurrentUser());
        importRepository.save(imported);
        entityManager.flush();
        entityManager.clear();
        return detail(agenceId, importId);
    }

    private ImportReleveBancaireResponse detailResponse(
            ImportReleveBancaire imported,
            List<LigneReleveBancaire> lines,
            List<InstrumentReglementClient> pending
    ) {
        return ImportReleveBancaireResponse.builder()
                .id(imported.getId())
                .compteTresorerieId(imported.getCompteTresorerie().getId())
                .compteTresorerie(imported.getCompteTresorerie().getLibelle())
                .nomFichier(imported.getNomFichier())
                .format(imported.getFormat())
                .statut(imported.getStatut())
                .configuration(readConfiguration(imported.getConfigurationJson()))
                .configurationComplete(true)
                .entetes(readStringList(imported.getEntetesJson()))
                .apercu(lines.stream().limit(10).map(this::rawData).toList())
                .soldeOuverture(imported.getSoldeOuverture())
                .soldeCloture(imported.getSoldeCloture())
                .totalDebits(imported.getTotalDebits())
                .totalCredits(imported.getTotalCredits())
                .nombreLignes(imported.getNombreLignes())
                .createdAt(imported.getCreatedAt())
                .valideLe(imported.getValideLe())
                .lignes(lines.stream().map(line -> lineResponse(
                        line,
                        imported.getStatut() == StatutImportReleveBancaire.BROUILLON
                                ? suggestions(line, pending, imported.getCompteTresorerie())
                                : List.of()
                )).toList())
                .build();
    }

    private ImportReleveBancaireResponse summaryResponse(ImportReleveBancaire imported) {
        return ImportReleveBancaireResponse.builder()
                .id(imported.getId())
                .compteTresorerieId(imported.getCompteTresorerie().getId())
                .compteTresorerie(imported.getCompteTresorerie().getLibelle())
                .nomFichier(imported.getNomFichier())
                .format(imported.getFormat())
                .statut(imported.getStatut())
                .configuration(readConfiguration(imported.getConfigurationJson()))
                .configurationComplete(true)
                .entetes(List.of())
                .apercu(List.of())
                .totalDebits(imported.getTotalDebits())
                .totalCredits(imported.getTotalCredits())
                .nombreLignes(imported.getNombreLignes())
                .createdAt(imported.getCreatedAt())
                .valideLe(imported.getValideLe())
                .lignes(List.of())
                .build();
    }

    private ImportReleveBancaireResponse previewResponse(
            String filename,
            FormatReleveBancaire format,
            ReleveBancaireParserService.ParseResult parsed
    ) {
        return ImportReleveBancaireResponse.builder()
                .nomFichier(safeOriginalName(filename, format))
                .format(format)
                .configuration(parsed.configuration())
                .configurationComplete(parsed.complete())
                .entetes(parsed.headers())
                .apercu(parsed.preview())
                .soldeOuverture(parsed.openingBalance())
                .soldeCloture(parsed.closingBalance())
                .totalDebits(sum(parsed.lines(), ReleveBancaireParserService.NormalizedLine::debit))
                .totalCredits(sum(parsed.lines(), ReleveBancaireParserService.NormalizedLine::credit))
                .nombreLignes(parsed.lines().size())
                .lignes(parsed.lines().stream().limit(100).map(source ->
                        ImportReleveBancaireResponse.Ligne.builder()
                                .numeroLigne(source.sourceRow())
                                .dateOperation(source.operationDate())
                                .dateValeur(source.valueDate())
                                .libelle(source.description())
                                .referenceBancaire(source.reference())
                                .contrepartie(source.counterparty())
                                .compteContrepartie(source.counterpartyAccount())
                                .debit(source.debit())
                                .credit(source.credit())
                                .solde(source.balance())
                                .statut(StatutLigneReleveBancaire.NON_RAPPROCHEE)
                                .rapprochements(List.of())
                                .suggestions(List.of())
                                .build()).toList())
                .build();
    }

    private ImportReleveBancaireResponse.Ligne lineResponse(
            LigneReleveBancaire line,
            List<ImportReleveBancaireResponse.Suggestion> suggestions
    ) {
        return ImportReleveBancaireResponse.Ligne.builder()
                .id(line.getId())
                .numeroLigne(line.getNumeroLigne())
                .dateOperation(line.getDateOperation())
                .dateValeur(line.getDateValeur())
                .libelle(line.getLibelle())
                .referenceBancaire(line.getReferenceBancaire())
                .contrepartie(line.getContrepartie())
                .compteContrepartie(line.getCompteContrepartie())
                .debit(line.getDebit())
                .credit(line.getCredit())
                .solde(line.getSolde())
                .statut(line.getStatut())
                .rapprochements(line.getRapprochements().stream()
                        .filter(row -> row.getStatut() != StatutRapprochementBancaire.ANNULE)
                        .map(this::reconciliationResponse)
                        .toList())
                .suggestions(suggestions)
                .build();
    }

    private ImportReleveBancaireResponse.Rapprochement reconciliationResponse(
            RapprochementBancaire reconciliation
    ) {
        InstrumentReglementClient instrument = reconciliation.getInstrumentReglement();
        return ImportReleveBancaireResponse.Rapprochement.builder()
                .id(reconciliation.getId())
                .instrumentId(instrument.getId())
                .numeroReglement(instrument.getReglement().getNumero())
                .payeur(instrument.getReglement().getPayeurNom())
                .mode(instrument.getMode().name())
                .referenceInstrument(instrument.getReferenceInstrument())
                .montantInstrument(instrument.getMontant())
                .montant(reconciliation.getMontant())
                .score(reconciliation.getScoreCorrespondance())
                .motif(reconciliation.getMotifCorrespondance())
                .statut(reconciliation.getStatut())
                .build();
    }

    private List<ImportReleveBancaireResponse.Suggestion> suggestions(
            LigneReleveBancaire line,
            List<InstrumentReglementClient> pending,
            CompteTresorerie account
    ) {
        if (money(line.getCredit()).signum() <= 0) {
            return List.of();
        }
        return pending.stream()
                .filter(instrument -> instrument.getCompteTresorerie() == null
                        || account.getId().equals(instrument.getCompteTresorerie().getId()))
                .map(instrument -> Map.entry(instrument, score(line, instrument, account)))
                .filter(entry -> entry.getValue().value() >= 40)
                .sorted(Map.Entry.<InstrumentReglementClient, MatchScore>comparingByValue(
                        Comparator.comparingInt(MatchScore::value)
                ).reversed())
                .limit(5)
                .map(entry -> {
                    InstrumentReglementClient instrument = entry.getKey();
                    MatchScore score = entry.getValue();
                    return ImportReleveBancaireResponse.Suggestion.builder()
                            .instrumentId(instrument.getId())
                            .numeroReglement(instrument.getReglement().getNumero())
                            .payeur(instrument.getReglement().getPayeurNom())
                            .mode(instrument.getMode().name())
                            .referenceInstrument(instrument.getReferenceInstrument())
                            .dateInstrument(instrument.getDateInstrument())
                            .montant(instrument.getMontant())
                            .score(score.value())
                            .motif(score.reason())
                            .build();
                })
                .toList();
    }

    private MatchScore score(
            LigneReleveBancaire line,
            InstrumentReglementClient instrument,
            CompteTresorerie account
    ) {
        int score = 0;
        List<String> reasons = new ArrayList<>();
        if (instrument.getCompteTresorerie() != null
                && account.getId().equals(instrument.getCompteTresorerie().getId())) {
            score += 20;
            reasons.add("même compte");
        }
        if (money(line.getCredit()).compareTo(money(instrument.getMontant())) == 0) {
            score += 45;
            reasons.add("montant exact");
        }
        String searchable = normalize(String.join(" ",
                Objects.toString(line.getLibelle(), ""),
                Objects.toString(line.getReferenceBancaire(), ""),
                Objects.toString(line.getContrepartie(), "")
        ));
        String reference = normalize(instrument.getReferenceInstrument());
        if (!reference.isBlank() && searchable.contains(reference)) {
            score += 25;
            reasons.add("référence trouvée");
        }
        String payer = normalize(instrument.getReglement().getPayeurNom());
        if (!payer.isBlank() && searchable.contains(payer)) {
            score += 10;
            reasons.add("payeur trouvé");
        }
        if (instrument.getDateInstrument() != null) {
            long days = Math.abs(ChronoUnit.DAYS.between(
                    instrument.getDateInstrument(),
                    line.getDateOperation()
            ));
            if (days <= 3) {
                score += 15 - (int) days * 3;
                reasons.add("date proche");
            }
        }
        return new MatchScore(score, String.join(", ", reasons));
    }

    private void validateInstrumentForAccount(
            InstrumentReglementClient instrument,
            CompteTresorerie account
    ) {
        if (instrument.getStatut() != StatutInstrumentReglement.EN_ATTENTE) {
            throw new BadRequestException("Le moyen de règlement n’est plus en attente");
        }
        if (instrument.getCompteTresorerie() != null
                && !account.getId().equals(instrument.getCompteTresorerie().getId())) {
            throw new BadRequestException("Le moyen de règlement est associé à un autre compte bancaire");
        }
    }

    private LigneReleveBancaire toEntity(
            ImportReleveBancaire imported,
            ReleveBancaireParserService.NormalizedLine source
    ) {
        return LigneReleveBancaire.builder()
                .importReleve(imported)
                .numeroLigne(source.sourceRow())
                .dateOperation(source.operationDate())
                .dateValeur(source.valueDate())
                .libelle(source.description())
                .referenceBancaire(source.reference())
                .contrepartie(source.counterparty())
                .compteContrepartie(source.counterpartyAccount())
                .debit(money(source.debit()))
                .credit(money(source.credit()))
                .solde(source.balance())
                .donneesBrutesJson(writeJson(source.rawData()))
                .statut(StatutLigneReleveBancaire.NON_RAPPROCHEE)
                .build();
    }

    private CompteTresorerie requireBankAccount(Long agenceId, Long accountId) {
        CompteTresorerie account = tresorerieService.findAccount(agenceId, accountId);
        if (account.getTypeCompte() != TypeCompteTresorerie.BANQUE) {
            throw new BadRequestException("Un relevé ne peut être importé que sur un compte bancaire");
        }
        return account;
    }

    private ImportReleveBancaire findImport(Long agenceId, Long importId) {
        return importRepository.findByIdAndAgenceId(importId, agenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Import de relevé bancaire", importId));
    }

    private ImportReleveBancaire findEditableImport(Long agenceId, Long importId) {
        ImportReleveBancaire imported = findImport(agenceId, importId);
        if (imported.getStatut() != StatutImportReleveBancaire.BROUILLON) {
            throw new BadRequestException("Un relevé validé ne peut plus être modifié");
        }
        requireBankAccount(agenceId, imported.getCompteTresorerie().getId());
        return imported;
    }

    private ProfilImportReleveBancaire requireProfile(
            Long agenceId,
            Long accountId,
            Long profileId,
            FormatReleveBancaire format
    ) {
        ProfilImportReleveBancaire profile = profileRepository
                .findByIdAndAgenceIdAndCompteTresorerieId(profileId, agenceId, accountId)
                .orElseThrow(() -> new ResourceNotFoundException("Profil d’import", profileId));
        if (profile.getFormat() != format) {
            throw new BadRequestException("Le profil sélectionné ne correspond pas au format du fichier");
        }
        if (!Boolean.TRUE.equals(profile.getActif())) {
            throw new BadRequestException("Le profil d’import sélectionné est inactif");
        }
        return profile;
    }

    private ProfilImportReleveBancaire saveProfileIfRequested(
            Long agenceId,
            CompteTresorerie account,
            FormatReleveBancaire format,
            ConfigurationImportReleveBancaireRequest configuration
    ) {
        if (!Boolean.TRUE.equals(configuration.getEnregistrerProfil())) {
            return null;
        }
        if (configuration.getNomProfil() == null || configuration.getNomProfil().isBlank()) {
            throw new BadRequestException("Le nom du profil d’import est obligatoire");
        }
        String name = configuration.getNomProfil().trim();
        ProfilImportReleveBancaire profile = profileRepository
                .findByAgenceIdAndCompteTresorerieIdAndNomIgnoreCase(
                        agenceId,
                        account.getId(),
                        name
                )
                .orElseGet(() -> ProfilImportReleveBancaire.builder()
                        .agence(account.getAgence())
                        .compteTresorerie(account)
                        .nom(name)
                        .build());
        profile.setFormat(format);
        profile.setConfigurationJson(writeJson(reusableConfiguration(configuration)));
        profile.setActif(true);
        return profileRepository.save(profile);
    }

    private ConfigurationImportReleveBancaireRequest reusableConfiguration(
            ConfigurationImportReleveBancaireRequest configuration
    ) {
        ConfigurationImportReleveBancaireRequest reusable = objectMapper.convertValue(
                configuration,
                ConfigurationImportReleveBancaireRequest.class
        );
        reusable.setEnregistrerProfil(false);
        reusable.setNomProfil(null);
        return reusable;
    }

    private FormatReleveBancaire detectFormat(String filename) {
        String lower = Objects.toString(filename, "").toLowerCase(Locale.ROOT);
        if (lower.endsWith(".csv")) {
            return FormatReleveBancaire.CSV;
        }
        if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
            return FormatReleveBancaire.XLSX;
        }
        if (lower.endsWith(".mt940") || lower.endsWith(".sta") || lower.endsWith(".txt")) {
            return FormatReleveBancaire.MT940;
        }
        throw new BadRequestException("Formats acceptés: CSV, XLS, XLSX et MT940");
    }

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Sélectionnez un relevé bancaire");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new BadRequestException("Le relevé bancaire ne doit pas dépasser 30 Mo");
        }
        detectFormat(file.getOriginalFilename());
    }

    private Path storageKey(
            Long agenceId,
            Long accountId,
            String originalName,
            FormatReleveBancaire format
    ) {
        String extension = extension(format);
        String base = safeOriginalName(originalName, format)
                .replaceAll("(?i)\\.(csv|xls|xlsx|mt940|sta|txt)$", "")
                .replaceAll("[^a-zA-Z0-9._-]", "-");
        return Path.of(
                String.valueOf(agenceId),
                String.valueOf(accountId),
                UUID.randomUUID() + "-" + base + extension
        );
    }

    private String safeOriginalName(String filename, FormatReleveBancaire format) {
        if (filename == null || filename.isBlank()) {
            return "releve" + extension(format);
        }
        String name = Path.of(filename).getFileName().toString().trim();
        return name.length() <= 255 ? name : name.substring(name.length() - 255);
    }

    private String extension(FormatReleveBancaire format) {
        return switch (format) {
            case CSV -> ".csv";
            case XLSX -> ".xlsx";
            case MT940 -> ".mt940";
        };
    }

    private String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (NoSuchAlgorithmException error) {
            throw new IllegalStateException("SHA-256 indisponible", error);
        }
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException error) {
            throw new IllegalStateException("Impossible de sérialiser la configuration d’import", error);
        }
    }

    private ConfigurationImportReleveBancaireRequest readConfiguration(String json) {
        try {
            return objectMapper.readValue(json, ConfigurationImportReleveBancaireRequest.class);
        } catch (JsonProcessingException error) {
            throw new IllegalStateException("Configuration d’import bancaire invalide", error);
        }
    }

    private List<String> readStringList(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(
                    json,
                    objectMapper.getTypeFactory().constructCollectionType(List.class, String.class)
            );
        } catch (JsonProcessingException error) {
            throw new IllegalStateException("En-têtes d’import bancaire invalides", error);
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, String> rawData(LigneReleveBancaire line) {
        if (line.getDonneesBrutesJson() == null || line.getDonneesBrutesJson().isBlank()) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(line.getDonneesBrutesJson(), LinkedHashMap.class);
        } catch (JsonProcessingException error) {
            return Map.of();
        }
    }

    private BigDecimal sum(
            Collection<ReleveBancaireParserService.NormalizedLine> lines,
            Function<ReleveBancaireParserService.NormalizedLine, BigDecimal> getter
    ) {
        return lines.stream().map(getter).map(this::money).reduce(ZERO, BigDecimal::add);
    }

    private BigDecimal money(BigDecimal value) {
        return (value == null ? BigDecimal.ZERO : value).setScale(2, RoundingMode.HALF_UP);
    }

    private String normalize(String value) {
        if (value == null) {
            return "";
        }
        return Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]", "");
    }

    private void deleteQuietly(Path path) {
        if (path == null) {
            return;
        }
        try {
            Files.deleteIfExists(path);
        } catch (IOException ignored) {
            // Temporary previews must not affect the request result.
        }
    }

    private record MatchScore(int value, String reason) {
    }
}
