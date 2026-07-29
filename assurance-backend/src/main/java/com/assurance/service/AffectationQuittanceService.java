package com.assurance.service;

import com.assurance.dto.request.EnregistrerAffectationQuittanceRequest;
import com.assurance.dto.request.UpsertRegleAffectationQuittanceRequest;
import com.assurance.dto.response.AffectationQuittancePageResponse;
import com.assurance.dto.response.AffectationQuittanceResponse;
import com.assurance.dto.response.ImportAffectationQuittancePreviewResponse;
import com.assurance.dto.response.RegleAffectationQuittancePageResponse;
import com.assurance.dto.response.RegleAffectationQuittanceResponse;
import com.assurance.entity.AffectationQuittanceCompagnie;
import com.assurance.entity.Agence;
import com.assurance.entity.CompagnieAssurance;
import com.assurance.entity.Contrat;
import com.assurance.entity.ContratClient;
import com.assurance.entity.LigneQuittance;
import com.assurance.entity.Quittance;
import com.assurance.entity.RegleAffectationQuittance;
import com.assurance.enums.CategorieQuittance;
import com.assurance.enums.CategorieMouvementContrat;
import com.assurance.enums.ModeAffectationQuittance;
import com.assurance.enums.ModeCalculCommission;
import com.assurance.enums.NatureAffectationQuittance;
import com.assurance.enums.NatureElementFacturable;
import com.assurance.enums.RoleClientContrat;
import com.assurance.enums.SourceAffectationQuittance;
import com.assurance.enums.StatutAffectationQuittance;
import com.assurance.enums.TypeContrat;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.AffectationQuittanceCompagnieRepository;
import com.assurance.repository.AgenceRepository;
import com.assurance.repository.CompagnieAssuranceRepository;
import com.assurance.repository.ContratClientRepository;
import com.assurance.repository.LigneQuittanceRepository;
import com.assurance.repository.QuittanceRepository;
import com.assurance.repository.RegleAffectationQuittanceRepository;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.DateUtil;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AffectationQuittanceService {

    private static final BigDecimal HUNDRED = new BigDecimal("100");
    private static final BigDecimal ZERO = new BigDecimal("0.00");
    private static final LocalDate OPEN_ENDED_DATE = LocalDate.of(9999, 12, 31);

    private final QuittanceRepository quittanceRepository;
    private final LigneQuittanceRepository ligneQuittanceRepository;
    private final ContratClientRepository contratClientRepository;
    private final AffectationQuittanceCompagnieRepository affectationRepository;
    private final RegleAffectationQuittanceRepository regleRepository;
    private final AgenceRepository agenceRepository;
    private final CompagnieAssuranceRepository compagnieRepository;

    @Transactional(readOnly = true)
    public AffectationQuittancePageResponse search(
            Long agenceId,
            Long compagnieId,
            TypeContrat typeContrat,
            NatureAffectationQuittance nature,
            LocalDate dateDu,
            LocalDate dateAu,
            String search,
            int page,
            int size
    ) {
        validateTenant(agenceId);
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(size, 1), 100));
        String normalizedSearch = normalizeSearch(search);
        Page<Quittance> result = quittanceRepository.searchForAffectation(
                agenceId,
                compagnieId,
                typeContrat,
                movementNature(nature),
                elementNature(nature),
                dateDu,
                dateAu,
                normalizedSearch,
                pageable
        );

        List<Quittance> quittances = result.getContent();
        Set<Long> quittanceIds = ids(quittances, Quittance::getId);
        Set<Long> contratIds = ids(quittances, quittance -> quittance.getContrat().getId());
        Map<Long, List<AffectationQuittanceCompagnie>> affectations = quittanceIds.isEmpty()
                ? Map.of()
                : affectationRepository.findByQuittanceIdIn(quittanceIds)
                        .stream()
                        .collect(Collectors.groupingBy(item -> item.getQuittance().getId()));
        Map<Long, String> souscripteurs = resolveSouscripteurs(contratIds);
        List<RegleAffectationQuittance> regles = regleRepository
                .findAllByAgenceIdOrderByCompagnieAssuranceNomAscTypeContratAscDateDebutDesc(agenceId);

        List<AffectationQuittanceResponse> rows = quittances.stream()
                .map(quittance -> {
                    RegleAffectationQuittance regle = findEffectiveRuleOrNull(regles, quittance);
                    return toResponse(
                            quittance,
                            affectations.getOrDefault(quittance.getId(), List.of()),
                            souscripteurs.get(quittance.getContrat().getId()),
                            regle,
                            false
                    );
                })
                .toList();

        BigDecimal montantTtc = rows.stream()
                .map(AffectationQuittanceResponse::getMontantTtc)
                .reduce(ZERO, BigDecimal::add);
        BigDecimal montantAffecte = rows.stream()
                .map(AffectationQuittanceResponse::getMontantAffecte)
                .reduce(ZERO, BigDecimal::add);

        return AffectationQuittancePageResponse.builder()
                .summary(AffectationQuittancePageResponse.Summary.builder()
                        .total(result.getTotalElements())
                        .nonAffectees(countStatus(rows, StatutAffectationQuittance.NON_AFFECTEE))
                        .partiellementAffectees(countStatus(rows, StatutAffectationQuittance.PARTIELLEMENT_AFFECTEE))
                        .affectees(countStatus(rows, StatutAffectationQuittance.AFFECTEE))
                        .avecEcart(countStatus(rows, StatutAffectationQuittance.AVEC_ECART))
                        .montantTtc(money(montantTtc))
                        .montantAffecte(money(montantAffecte))
                        .build())
                .page(AffectationQuittancePageResponse.PageInfo.builder()
                        .number(result.getNumber())
                        .size(result.getSize())
                        .totalElements(result.getTotalElements())
                        .totalPages(result.getTotalPages())
                        .first(result.isFirst())
                        .last(result.isLast())
                        .build())
                .rows(rows)
                .build();
    }

    @Transactional(readOnly = true)
    public AffectationQuittanceResponse detail(Long agenceId, Long quittanceId, Boolean avecRetenue) {
        Quittance quittance = requireQuittance(agenceId, quittanceId);
        RegleAffectationQuittance regle = requireEffectiveRule(agenceId, quittance);
        List<AffectationQuittanceCompagnie> affectations = affectationRepository
                .findByQuittanceIdOrderByDateEffetAscNumeroQuittanceCompagnieAsc(quittanceId);
        String souscripteur = resolveSouscripteurs(Set.of(quittance.getContrat().getId()))
                .get(quittance.getContrat().getId());
        AffectationQuittanceResponse response = toResponse(
                quittance,
                affectations,
                souscripteur,
                regle,
                true
        );
        boolean retentionEnabled = avecRetenue != null
                ? avecRetenue
                : affectations.stream().findFirst()
                        .map(AffectationQuittanceCompagnie::getAvecRetenue)
                        .orElse(Boolean.TRUE.equals(regle.getRetenueParDefaut()));
        response.setAvecRetenue(retentionEnabled);
        if (quittance.getContrat().getTypeContrat() != TypeContrat.FLOTTE) {
            BigDecimal commission = calculateCommission(quittance, regle);
            Retention retention = calculateRetention(commission, retentionEnabled, regle);
            response.setCommissionCalculee(commission);
            response.setRetenueCalculee(retention.amount());
            response.setNetCompagnieCalcule(money(
                    requiredAmount(quittance.getPrimeTotale(), "Montant TTC de la quittance")
                            .subtract(commission)
                            .add(retention.amount())
            ));
        }
        return response;
    }

    @Transactional
    public AffectationQuittanceResponse save(
            Long agenceId,
            Long userId,
            Long quittanceId,
            EnregistrerAffectationQuittanceRequest request
    ) {
        Quittance quittance = requireQuittance(agenceId, quittanceId);
        RegleAffectationQuittance regle = requireEffectiveRule(agenceId, quittance);
        validateMode(quittance.getContrat().getTypeContrat(), regle, request.getSource());

        List<AffectationQuittanceCompagnie> entities = quittance.getContrat().getTypeContrat() == TypeContrat.FLOTTE
                ? buildFleetAffectations(agenceId, userId, quittance, regle, request)
                : List.of(buildAutomaticAffectation(agenceId, userId, quittance, regle, request));

        validateRequestNumbers(agenceId, quittance, entities);
        affectationRepository.deleteByQuittanceId(quittanceId);
        affectationRepository.flush();
        affectationRepository.saveAll(entities);

        String souscripteur = resolveSouscripteurs(Set.of(quittance.getContrat().getId()))
                .get(quittance.getContrat().getId());
        return toResponse(quittance, entities, souscripteur, regle, true);
    }

    @Transactional
    public void clear(Long agenceId, Long quittanceId) {
        requireQuittance(agenceId, quittanceId);
        affectationRepository.deleteByQuittanceId(quittanceId);
    }

    @Transactional(readOnly = true)
    public ImportAffectationQuittancePreviewResponse previewImport(
            Long agenceId,
            Long quittanceId,
            boolean avecRetenue,
            MultipartFile file
    ) {
        Quittance quittance = requireQuittance(agenceId, quittanceId);
        RegleAffectationQuittance regle = requireEffectiveRule(agenceId, quittance);
        if (quittance.getContrat().getTypeContrat() != TypeContrat.FLOTTE
                || regle.getModeAffectation() != ModeAffectationQuittance.MANUEL_OU_IMPORT) {
            throw new BadRequestException("L'import est disponible uniquement pour une quittance flotte configurée en mode manuel/import");
        }
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Sélectionnez un fichier Excel");
        }

        ParsedImport parsed = parseImport(file, quittance, regle, avecRetenue);
        BigDecimal montantTtc = sum(parsed.lines(), AffectationQuittanceResponse.Ligne::getMontantTtc);
        BigDecimal expected = requiredAmount(quittance.getPrimeTotale(), "Montant TTC de la quittance");
        BigDecimal ecart = money(montantTtc.subtract(expected));
        boolean equilibre = ecart.signum() == 0;
        if (!equilibre) {
            parsed.errors().add(
                    "Le total TTC importé ne correspond pas au montant de la quittance de production"
            );
        }

        return ImportAffectationQuittancePreviewResponse.builder()
                .fichier(cleanFileName(file.getOriginalFilename()))
                .lignesLues(parsed.lines().size())
                .lignes(parsed.lines())
                .erreurs(parsed.errors())
                .primeNette(sum(parsed.lines(), AffectationQuittanceResponse.Ligne::getPrimeNette))
                .montantTaxes(sum(parsed.lines(), AffectationQuittanceResponse.Ligne::getMontantTaxes))
                .accessoires(sum(parsed.lines(), AffectationQuittanceResponse.Ligne::getAccessoires))
                .montantTtc(money(montantTtc))
                .commissionNette(sum(parsed.lines(), AffectationQuittanceResponse.Ligne::getCommissionNette))
                .netCompagnie(sum(parsed.lines(), AffectationQuittanceResponse.Ligne::getNetCompagnie))
                .ecart(ecart)
                .equilibre(equilibre)
                .build();
    }

    @Transactional(readOnly = true)
    public RegleAffectationQuittancePageResponse listRules(
            Long agenceId,
            int page,
            int size
    ) {
        validateTenant(agenceId);
        Page<RegleAffectationQuittance> result =
                regleRepository.findByAgenceIdOrderByCompagnieAssuranceNomAscTypeContratAscDateDebutDesc(
                        agenceId,
                        PageRequest.of(Math.max(0, page), Math.min(Math.max(size, 1), 100))
                );
        return RegleAffectationQuittancePageResponse.builder()
                .rows(result.getContent().stream().map(this::toRuleResponse).toList())
                .page(RegleAffectationQuittancePageResponse.PageInfo.builder()
                        .number(result.getNumber())
                        .size(result.getSize())
                        .totalPages(result.getTotalPages())
                        .totalElements(result.getTotalElements())
                        .first(result.isFirst())
                        .last(result.isLast())
                        .build())
                .build();
    }

    @Transactional
    public RegleAffectationQuittanceResponse createRule(
            Long agenceId,
            UpsertRegleAffectationQuittanceRequest request
    ) {
        Agence agence = requireAgence(agenceId);
        CompagnieAssurance compagnie = requireCompagnie(request.getCompagnieAssuranceId());
        validateRule(request, agenceId, 0L);
        RegleAffectationQuittance entity = new RegleAffectationQuittance();
        entity.setAgence(agence);
        entity.setCompagnieAssurance(compagnie);
        applyRule(entity, request);
        return toRuleResponse(regleRepository.save(entity));
    }

    @Transactional
    public RegleAffectationQuittanceResponse updateRule(
            Long agenceId,
            Long ruleId,
            UpsertRegleAffectationQuittanceRequest request
    ) {
        RegleAffectationQuittance entity = regleRepository.findByAgenceIdAndId(agenceId, ruleId)
                .orElseThrow(() -> new ResourceNotFoundException("Règle d'affectation", ruleId));
        requireUnusedRule(entity);
        CompagnieAssurance compagnie = requireCompagnie(request.getCompagnieAssuranceId());
        validateRule(request, agenceId, ruleId);
        entity.setCompagnieAssurance(compagnie);
        applyRule(entity, request);
        return toRuleResponse(regleRepository.save(entity));
    }

    @Transactional
    public void deleteRule(Long agenceId, Long ruleId) {
        RegleAffectationQuittance entity = regleRepository.findByAgenceIdAndId(agenceId, ruleId)
                .orElseThrow(() -> new ResourceNotFoundException("Règle d'affectation", ruleId));
        requireUnusedRule(entity);
        regleRepository.delete(entity);
    }

    private void requireUnusedRule(RegleAffectationQuittance rule) {
        long allocations = regleRepository.countAllocationsUsingRule(
                rule.getAgence().getId(),
                rule.getCompagnieAssurance().getId(),
                rule.getTypeContrat(),
                rule.getDateDebut(),
                rule.getDateFin() != null ? rule.getDateFin() : OPEN_ENDED_DATE
        );
        if (allocations > 0) {
            throw new BadRequestException(
                    "Cette règle a déjà produit des affectations. Créez une nouvelle règle datée pour modifier le calcul"
            );
        }
    }

    private AffectationQuittanceCompagnie buildAutomaticAffectation(
            Long agenceId,
            Long userId,
            Quittance quittance,
            RegleAffectationQuittance regle,
            EnregistrerAffectationQuittanceRequest request
    ) {
        String numero = trimToNull(request.getNumeroQuittanceCompagnie());
        if (numero == null) {
            throw new BadRequestException("Le numéro de quittance compagnie est obligatoire");
        }
        if (request.getSource() != SourceAffectationQuittance.AUTOMATIQUE) {
            throw new BadRequestException("Une quittance Mono ou Convention doit être affectée en mode automatique");
        }

        BigDecimal commissionNette = calculateCommission(quittance, regle);
        Retention retention = calculateRetention(commissionNette, request.getAvecRetenue(), regle);
        BigDecimal montantTtc = requiredAmount(quittance.getPrimeTotale(), "Montant TTC de la quittance");
        BigDecimal accessoires = requiredAmount(quittance.getAccessoire(), "Accessoires de la quittance")
                .add(requiredAmount(quittance.getCnpac(), "CNPAC de la quittance"));

        return AffectationQuittanceCompagnie.builder()
                .agence(requireAgence(agenceId))
                .quittance(quittance)
                .compagnieAssurance(requireQuittanceCompagnie(quittance))
                .numeroQuittanceCompagnie(numero)
                .source(SourceAffectationQuittance.AUTOMATIQUE)
                .dateEffet(resolveDateEffet(quittance))
                .dateEcheance(resolveDateEcheance(quittance))
                .primeNette(requiredAmount(quittance.getPrimeNette(), "Prime nette de la quittance"))
                .montantTaxes(requiredAmount(quittance.getTaxe(), "Taxes de la quittance")
                        .add(requiredAmount(quittance.getTaxeParafiscale(), "Taxe parafiscale de la quittance")))
                .accessoires(money(accessoires))
                .montantTtc(montantTtc)
                .commissionNette(commissionNette)
                .avecRetenue(Boolean.TRUE.equals(request.getAvecRetenue()))
                .tauxRetenue(retention.rate())
                .montantRetenue(retention.amount())
                .netCompagnie(money(montantTtc.subtract(commissionNette).add(retention.amount())))
                .creePar(userId)
                .modifiePar(userId)
                .build();
    }

    private List<AffectationQuittanceCompagnie> buildFleetAffectations(
            Long agenceId,
            Long userId,
            Quittance quittance,
            RegleAffectationQuittance regle,
            EnregistrerAffectationQuittanceRequest request
    ) {
        if (request.getSource() == SourceAffectationQuittance.AUTOMATIQUE) {
            throw new BadRequestException("Une quittance flotte doit être saisie manuellement ou importée");
        }
        if (request.getLignes() == null || request.getLignes().isEmpty()) {
            throw new BadRequestException("Ajoutez au moins une ligne de quittance compagnie");
        }
        Agence agence = requireAgence(agenceId);
        CompagnieAssurance compagnie = requireQuittanceCompagnie(quittance);
        String fichierSource = request.getSource() == SourceAffectationQuittance.IMPORT
                ? trimToNull(request.getFichierSource())
                : null;
        if (request.getSource() == SourceAffectationQuittance.IMPORT && fichierSource == null) {
            throw new BadRequestException("Le fichier source de l'import est obligatoire");
        }

        List<AffectationQuittanceCompagnie> result = new ArrayList<>();
        for (EnregistrerAffectationQuittanceRequest.Ligne line : request.getLignes()) {
            validateFleetLine(line, quittance);
            BigDecimal commission = money(line.getCommissionNette());
            Retention retention = calculateRetention(commission, request.getAvecRetenue(), regle);
            result.add(AffectationQuittanceCompagnie.builder()
                    .agence(agence)
                    .quittance(quittance)
                    .compagnieAssurance(compagnie)
                    .numeroQuittanceCompagnie(line.getNumeroQuittanceCompagnie().trim())
                    .source(request.getSource())
                    .dateEffet(line.getDateEffet())
                    .dateEcheance(line.getDateEcheance())
                    .acteSource(trimToNull(line.getActeSource()))
                    .categorieSource(trimToNull(line.getCategorieSource()))
                    .statutSource(trimToNull(line.getStatutSource()))
                    .fichierSource(fichierSource)
                    .primeNette(money(line.getPrimeNette()))
                    .montantTaxes(money(line.getMontantTaxes()))
                    .accessoires(money(line.getAccessoires()))
                    .montantTtc(money(line.getMontantTtc()))
                    .commissionNette(commission)
                    .avecRetenue(Boolean.TRUE.equals(request.getAvecRetenue()))
                    .tauxRetenue(retention.rate())
                    .montantRetenue(retention.amount())
                    .netCompagnie(money(line.getMontantTtc().subtract(commission).add(retention.amount())))
                    .creePar(userId)
                    .modifiePar(userId)
                    .build());
        }
        return result;
    }

    private void validateFleetLine(
            EnregistrerAffectationQuittanceRequest.Ligne line,
            Quittance quittance
    ) {
        if (trimToNull(line.getNumeroQuittanceCompagnie()) == null) {
            throw new BadRequestException("Chaque ligne doit avoir un numéro de quittance compagnie");
        }
        requireAmount(line.getPrimeNette(), "Prime nette");
        requireAmount(line.getMontantTaxes(), "Montant taxes");
        requireAmount(line.getAccessoires(), "Accessoires");
        requireAmount(line.getMontantTtc(), "Montant TTC");
        requireAmount(line.getCommissionNette(), "Commission nette");
        validateAllocationPeriod(
                line.getDateEffet(),
                line.getDateEcheance(),
                quittance,
                line.getNumeroQuittanceCompagnie()
        );

        BigDecimal calculatedTtc = line.getPrimeNette()
                .add(line.getMontantTaxes())
                .add(line.getAccessoires());
        if (money(calculatedTtc).compareTo(money(line.getMontantTtc())) != 0) {
            throw new BadRequestException(
                    "Le montant TTC de la quittance " + line.getNumeroQuittanceCompagnie()
                            + " ne correspond pas à prime nette + taxes + accessoires"
            );
        }
    }

    private void validateRequestNumbers(
            Long agenceId,
            Quittance quittance,
            List<AffectationQuittanceCompagnie> entities
    ) {
        Set<String> requestNumbers = new HashSet<>();
        for (AffectationQuittanceCompagnie entity : entities) {
            String normalized = entity.getNumeroQuittanceCompagnie().trim().toUpperCase(Locale.ROOT);
            if (!requestNumbers.add(normalized)) {
                throw new BadRequestException("Le numéro de quittance " + entity.getNumeroQuittanceCompagnie() + " est dupliqué");
            }
            if (affectationRepository
                    .existsByAgenceIdAndCompagnieAssuranceIdAndNumeroQuittanceCompagnieIgnoreCaseAndQuittanceIdNot(
                            agenceId,
                            entity.getCompagnieAssurance().getId(),
                            entity.getNumeroQuittanceCompagnie(),
                            quittance.getId()
                    )) {
                throw new BadRequestException(
                        "Le numéro de quittance " + entity.getNumeroQuittanceCompagnie() + " est déjà affecté"
                );
            }
        }
    }

    private BigDecimal calculateCommission(Quittance quittance, RegleAffectationQuittance regle) {
        List<LigneQuittance> categoryLines = ligneQuittanceRepository
                .findByQuittanceIdOrderByOrdreAsc(quittance.getId())
                .stream()
                .filter(line -> !Boolean.TRUE.equals(line.getGlobale()))
                .toList();
        if (categoryLines.isEmpty()) {
            throw new BadRequestException(
                    "Les lignes comptables de la quittance sont requises pour calculer la commission"
            );
        }

        Map<CategorieQuittance, BigDecimal> primes = categoryLines.stream()
                .collect(Collectors.toMap(
                        LigneQuittance::getCategorie,
                        line -> requiredAmount(line.getPrimeNette(), "Prime nette d'une ligne de quittance"),
                        BigDecimal::add
                ));
        BigDecimal categoryNetTotal = primes.values().stream().reduce(ZERO, BigDecimal::add);
        BigDecimal quittanceNetTotal = requiredAmount(quittance.getPrimeNette(), "Prime nette de la quittance");
        if (money(categoryNetTotal).compareTo(money(quittanceNetTotal)) != 0) {
            throw new BadRequestException(
                    "Le total net des lignes comptables ne correspond pas à la prime nette de la quittance"
            );
        }

        BigDecimal base = percent(primes.getOrDefault(CategorieQuittance.AUTOMOBILE, ZERO), regle.getTauxCommissionAutomobile())
                .add(percent(primes.getOrDefault(CategorieQuittance.EVCAT, ZERO), regle.getTauxCommissionEvcat()))
                .add(percent(primes.getOrDefault(CategorieQuittance.CORPOREL, ZERO), regle.getTauxCommissionCorporel()));
        if (regle.getModeCalculCommission() == ModeCalculCommission.TAUX_BRUT_TVA_INCLUSE) {
            base = base.subtract(percent(base, regle.getTauxTvaIncluseCommission()));
        }
        return money(base);
    }

    private Retention calculateRetention(
            BigDecimal commissionNette,
            Boolean avecRetenue,
            RegleAffectationQuittance regle
    ) {
        if (!Boolean.TRUE.equals(avecRetenue)) {
            return new Retention(rate(regle.getTauxRetenue()), ZERO);
        }
        return new Retention(
                rate(regle.getTauxRetenue()),
                money(percent(commissionNette, regle.getTauxRetenue()))
        );
    }

    private AffectationQuittanceResponse toResponse(
            Quittance quittance,
            List<AffectationQuittanceCompagnie> affectations,
            String souscripteur,
            RegleAffectationQuittance regle,
            boolean includeLines
    ) {
        BigDecimal expected = requiredAmount(quittance.getPrimeTotale(), "Montant TTC de la quittance");
        BigDecimal allocated = affectations.stream()
                .map(AffectationQuittanceCompagnie::getMontantTtc)
                .map(value -> requiredAmount(value, "Montant TTC d'une affectation"))
                .reduce(ZERO, BigDecimal::add);
        if (regle == null && !affectations.isEmpty()) {
            throw new BadRequestException(
                    "La règle ayant produit cette affectation n'est plus disponible"
            );
        }
        StatutAffectationQuittance statut = affectations.isEmpty()
                ? StatutAffectationQuittance.NON_AFFECTEE
                : resolveStatus(expected, allocated);
        boolean avecRetenue = affectations.stream()
                .findFirst()
                .map(AffectationQuittanceCompagnie::getAvecRetenue)
                .map(Boolean.TRUE::equals)
                .orElse(regle != null && Boolean.TRUE.equals(regle.getRetenueParDefaut()));
        Contrat contrat = quittance.getContrat();

        return AffectationQuittanceResponse.builder()
                .quittanceId(quittance.getId())
                .contratId(contrat.getId())
                .mouvementId(quittance.getMouvementContrat() != null ? quittance.getMouvementContrat().getId() : null)
                .dossier(firstNonBlank(contrat.getNumeroDossier(), contrat.getNumeroContrat(), "#" + contrat.getId()))
                .produit(productLabel(contrat))
                .typeContrat(contrat.getTypeContrat())
                .mouvement(movementLabel(quittance))
                .nature(resolveNature(quittance))
                .souscripteur(firstNonBlank(souscripteur, "-"))
                .police(firstNonBlank(contrat.getNumeroPolice(), contrat.getNumeroContrat(), "-"))
                .compagnieId(resolveCompagnieId(quittance))
                .compagnie(resolveCompagnieName(quittance))
                .dateEffet(resolveDateEffet(quittance))
                .dateEcheance(resolveDateEcheance(quittance))
                .primeNette(requiredAmount(quittance.getPrimeNette(), "Prime nette de la quittance"))
                .montantTaxes(money(
                        requiredAmount(quittance.getTaxe(), "Taxes de la quittance")
                                .add(requiredAmount(quittance.getTaxeParafiscale(), "Taxe parafiscale de la quittance"))
                ))
                .accessoires(money(
                        requiredAmount(quittance.getAccessoire(), "Accessoires de la quittance")
                                .add(requiredAmount(quittance.getCnpac(), "CNPAC de la quittance"))
                ))
                .montantTtc(expected)
                .montantAffecte(money(allocated))
                .ecart(money(allocated.subtract(expected)))
                .numerosQuittanceCompagnie(affectations.stream()
                        .map(AffectationQuittanceCompagnie::getNumeroQuittanceCompagnie)
                        .collect(Collectors.joining(", ")))
                .avecRetenue(avecRetenue)
                .statutAffectation(statut)
                .regle(regle != null ? toRuleResponse(regle) : null)
                .lignes(includeLines ? affectations.stream().map(this::toLineResponse).toList() : List.of())
                .build();
    }

    private NatureAffectationQuittance resolveNature(Quittance quittance) {
        if (quittance.getElementFacturable() != null
                && quittance.getElementFacturable().getNature() == NatureElementFacturable.CARTE_VERTE) {
            return NatureAffectationQuittance.CARTE_VERTE;
        }
        if (quittance.getMouvementContrat() == null
                || quittance.getMouvementContrat().getTypeMouvement() == null) {
            return null;
        }
        return switch (quittance.getMouvementContrat().getTypeMouvement().getCategorie()) {
            case AFFAIRE_NOUVELLE -> NatureAffectationQuittance.AFFAIRE_NOUVELLE;
            case AVENANT -> NatureAffectationQuittance.AVENANT;
            case RENOUVELLEMENT -> NatureAffectationQuittance.RENOUVELLEMENT;
            case DOCUMENT, SERVICE -> null;
        };
    }

    private CategorieMouvementContrat movementNature(NatureAffectationQuittance nature) {
        if (nature == null || nature == NatureAffectationQuittance.CARTE_VERTE) {
            return null;
        }
        return CategorieMouvementContrat.valueOf(nature.name());
    }

    private NatureElementFacturable elementNature(NatureAffectationQuittance nature) {
        return nature == NatureAffectationQuittance.CARTE_VERTE
                ? NatureElementFacturable.CARTE_VERTE
                : null;
    }

    private AffectationQuittanceResponse.Ligne toLineResponse(AffectationQuittanceCompagnie entity) {
        return AffectationQuittanceResponse.Ligne.builder()
                .id(entity.getId())
                .numeroQuittanceCompagnie(entity.getNumeroQuittanceCompagnie())
                .source(entity.getSource())
                .dateEffet(entity.getDateEffet())
                .dateEcheance(entity.getDateEcheance())
                .acteSource(entity.getActeSource())
                .categorieSource(entity.getCategorieSource())
                .statutSource(entity.getStatutSource())
                .fichierSource(entity.getFichierSource())
                .primeNette(entity.getPrimeNette())
                .montantTaxes(entity.getMontantTaxes())
                .accessoires(entity.getAccessoires())
                .montantTtc(entity.getMontantTtc())
                .commissionNette(entity.getCommissionNette())
                .avecRetenue(entity.getAvecRetenue())
                .tauxRetenue(entity.getTauxRetenue())
                .montantRetenue(entity.getMontantRetenue())
                .netCompagnie(entity.getNetCompagnie())
                .build();
    }

    private ParsedImport parseImport(
            MultipartFile file,
            Quittance quittance,
            RegleAffectationQuittance regle,
            boolean avecRetenue
    ) {
        List<AffectationQuittanceResponse.Ligne> lines = new ArrayList<>();
        List<String> errors = new ArrayList<>();
        Set<String> numbers = new HashSet<>();
        try (Workbook workbook = new XSSFWorkbook(file.getInputStream())) {
            if (workbook.getNumberOfSheets() == 0) {
                throw new BadRequestException("Le fichier Excel ne contient aucune feuille");
            }
            Sheet sheet = workbook.getSheetAt(0);
            Row headerRow = sheet.getRow(sheet.getFirstRowNum());
            if (headerRow == null) {
                throw new BadRequestException("L'en-tête du fichier Excel est manquant");
            }
            Map<String, Integer> columns = readHeaders(headerRow);
            requireColumns(columns);
            String expectedPolicy = normalizeIdentifier(quittance.getContrat().getNumeroPolice());

            for (int rowIndex = headerRow.getRowNum() + 1; rowIndex <= sheet.getLastRowNum(); rowIndex++) {
                Row row = sheet.getRow(rowIndex);
                if (row == null || isEmptyRow(row)) {
                    continue;
                }
                try {
                    String number = requiredText(row, columns, "noquittance", rowIndex);
                    String policy = text(row, columns, "nopolice");
                    if (expectedPolicy != null && !expectedPolicy.equals(normalizeIdentifier(policy))) {
                        throw new BadRequestException("la police " + policy + " ne correspond pas à " + quittance.getContrat().getNumeroPolice());
                    }
                    if (!numbers.add(number.trim().toUpperCase(Locale.ROOT))) {
                        throw new BadRequestException("le numéro " + number + " est dupliqué dans le fichier");
                    }
                    if (affectationRepository
                            .existsByAgenceIdAndCompagnieAssuranceIdAndNumeroQuittanceCompagnieIgnoreCaseAndQuittanceIdNot(
                                    quittance.getContrat().getAgence().getId(),
                                    requireQuittanceCompagnie(quittance).getId(),
                                    number,
                                    quittance.getId()
                            )) {
                        throw new BadRequestException("le numéro " + number + " est déjà affecté");
                    }
                    BigDecimal primeNette = decimal(row, columns, "primenette");
                    BigDecimal taxes = decimal(row, columns, "taxe");
                    BigDecimal accessoires = decimal(row, columns, "accessoires");
                    BigDecimal montantTtc = decimal(row, columns, "montantttc");
                    BigDecimal commission = decimal(row, columns, "commissionnette");
                    LocalDate lineEffectDate = date(row, columns, "dateeffet");
                    LocalDate lineEndDate = optionalDate(row, columns, "datefin");
                    validateAllocationPeriod(lineEffectDate, lineEndDate, quittance, number);
                    BigDecimal calculatedTtc = primeNette.add(taxes).add(accessoires);
                    if (money(calculatedTtc).compareTo(money(montantTtc)) != 0) {
                        throw new BadRequestException("le montant TTC ne correspond pas à prime nette + taxes + accessoires");
                    }
                    Retention retention = calculateRetention(commission, avecRetenue, regle);
                    lines.add(AffectationQuittanceResponse.Ligne.builder()
                            .numeroQuittanceCompagnie(number)
                            .source(SourceAffectationQuittance.IMPORT)
                            .dateEffet(lineEffectDate)
                            .dateEcheance(lineEndDate)
                            .acteSource(text(row, columns, "acte"))
                            .categorieSource(text(row, columns, "categorie"))
                            .statutSource(text(row, columns, "statut"))
                            .fichierSource(cleanFileName(file.getOriginalFilename()))
                            .primeNette(money(primeNette))
                            .montantTaxes(money(taxes))
                            .accessoires(money(accessoires))
                            .montantTtc(money(montantTtc))
                            .commissionNette(money(commission))
                            .avecRetenue(avecRetenue)
                            .tauxRetenue(retention.rate())
                            .montantRetenue(retention.amount())
                            .netCompagnie(money(montantTtc.subtract(commission).add(retention.amount())))
                            .build());
                } catch (RuntimeException exception) {
                    errors.add("Ligne " + (rowIndex + 1) + " : " + exception.getMessage());
                }
            }
        } catch (IOException exception) {
            throw new BadRequestException("Lecture du fichier Excel impossible");
        }
        if (lines.isEmpty() && errors.isEmpty()) {
            errors.add("Le fichier ne contient aucune ligne exploitable");
        }
        return new ParsedImport(lines, errors);
    }

    private Map<String, Integer> readHeaders(Row row) {
        Map<String, Integer> columns = new HashMap<>();
        DataFormatter formatter = new DataFormatter(Locale.FRANCE);
        for (Cell cell : row) {
            String key = normalizeHeader(formatter.formatCellValue(cell));
            if (!key.isBlank()) {
                columns.put(key, cell.getColumnIndex());
            }
        }
        return columns;
    }

    private void requireColumns(Map<String, Integer> columns) {
        List<String> missing = new ArrayList<>();
        requireColumn(columns, missing, "N° Police", "nopolice");
        requireColumn(columns, missing, "N° Quittance", "noquittance");
        requireColumn(columns, missing, "Date effet", "dateeffet");
        requireColumn(columns, missing, "Prime nette", "primenette");
        requireColumn(columns, missing, "Taxe", "taxe");
        requireColumn(columns, missing, "Accessoires", "accessoires");
        requireColumn(columns, missing, "Montant TTC", "montantttc");
        requireColumn(columns, missing, "Commission nette", "commissionnette");
        if (!missing.isEmpty()) {
            throw new BadRequestException("Colonnes Excel manquantes : " + String.join(", ", missing));
        }
    }

    private void requireColumn(Map<String, Integer> columns, List<String> missing, String label, String key) {
        if (!columns.containsKey(key)) {
            missing.add(label);
        }
    }

    private BigDecimal decimal(Row row, Map<String, Integer> columns, String key) {
        Cell cell = cell(row, columns, key);
        if (cell == null || cell.getCellType() == CellType.BLANK) {
            throw new BadRequestException("montant manquant pour " + key);
        }
        if (cell.getCellType() == CellType.NUMERIC) {
            return money(BigDecimal.valueOf(cell.getNumericCellValue()));
        }
        String raw = new DataFormatter(Locale.FRANCE).formatCellValue(cell);
        String normalized = raw.replace("\u00A0", "").replace(" ", "");
        if (normalized.contains(",")) {
            normalized = normalized.replace(".", "").replace(",", ".");
        }
        try {
            return money(new BigDecimal(normalized));
        } catch (NumberFormatException exception) {
            throw new BadRequestException("montant invalide pour " + key);
        }
    }

    private LocalDate date(Row row, Map<String, Integer> columns, String key) {
        LocalDate result = optionalDate(row, columns, key);
        if (result == null) {
            throw new BadRequestException("date manquante pour " + key);
        }
        return result;
    }

    private LocalDate optionalDate(Row row, Map<String, Integer> columns, String key) {
        Cell cell = cell(row, columns, key);
        if (cell == null || cell.getCellType() == CellType.BLANK) {
            return null;
        }
        if (cell.getCellType() == CellType.NUMERIC && DateUtil.isCellDateFormatted(cell)) {
            return cell.getDateCellValue().toInstant().atZone(ZoneId.systemDefault()).toLocalDate();
        }
        String raw = new DataFormatter(Locale.FRANCE).formatCellValue(cell).trim();
        for (DateTimeFormatter formatter : List.of(
                DateTimeFormatter.ofPattern("dd/MM/yyyy"),
                DateTimeFormatter.ISO_LOCAL_DATE
        )) {
            try {
                return LocalDate.parse(raw, formatter);
            } catch (DateTimeParseException ignored) {
                // Try the next supported format.
            }
        }
        throw new BadRequestException("date invalide pour " + key);
    }

    private String requiredText(Row row, Map<String, Integer> columns, String key, int rowIndex) {
        String value = text(row, columns, key);
        if (trimToNull(value) == null) {
            throw new BadRequestException(key + " manquant à la ligne " + (rowIndex + 1));
        }
        return value.trim();
    }

    private String text(Row row, Map<String, Integer> columns, String key) {
        Cell cell = cell(row, columns, key);
        return cell == null ? null : trimToNull(new DataFormatter(Locale.FRANCE).formatCellValue(cell));
    }

    private Cell cell(Row row, Map<String, Integer> columns, String key) {
        Integer index = columns.get(key);
        return index == null ? null : row.getCell(index);
    }

    private boolean isEmptyRow(Row row) {
        DataFormatter formatter = new DataFormatter(Locale.FRANCE);
        for (Cell cell : row) {
            if (!formatter.formatCellValue(cell).isBlank()) {
                return false;
            }
        }
        return true;
    }

    private void validateRule(UpsertRegleAffectationQuittanceRequest request, Long agenceId, Long excludedId) {
        if (request.getDateFin() != null && request.getDateFin().isBefore(request.getDateDebut())) {
            throw new BadRequestException("La date de fin doit être postérieure ou égale à la date de début");
        }
        validatePercentage(request.getTauxCommissionAutomobile(), "Taux commission automobile");
        validatePercentage(request.getTauxCommissionEvcat(), "Taux commission EVCAT");
        validatePercentage(request.getTauxCommissionCorporel(), "Taux commission corporel");
        validatePercentage(request.getTauxTvaIncluseCommission(), "Taux TVA incluse");
        validatePercentage(request.getTauxRetenue(), "Taux retenue");
        if (request.getTypeContrat() == TypeContrat.FLOTTE
                && request.getModeAffectation() != ModeAffectationQuittance.MANUEL_OU_IMPORT) {
            throw new BadRequestException("Une règle flotte doit utiliser le mode manuel/import");
        }
        if (request.getTypeContrat() == TypeContrat.FLOTTE
                && (request.getModeCalculCommission() != ModeCalculCommission.TAUX_NET
                || request.getTauxCommissionAutomobile().signum() != 0
                || request.getTauxCommissionEvcat().signum() != 0
                || request.getTauxCommissionCorporel().signum() != 0
                || request.getTauxTvaIncluseCommission().signum() != 0)) {
            throw new BadRequestException(
                    "Les taux de commission par catégorie ne s'appliquent pas aux quittances flotte"
            );
        }
        if (request.getTypeContrat() != TypeContrat.FLOTTE
                && request.getModeAffectation() != ModeAffectationQuittance.AUTOMATIQUE) {
            throw new BadRequestException("Une règle Mono ou Convention doit utiliser le mode automatique");
        }
        if (request.getTypeContrat() != TypeContrat.FLOTTE
                && request.getModeCalculCommission() == ModeCalculCommission.TAUX_NET
                && request.getTauxTvaIncluseCommission().signum() != 0) {
            throw new BadRequestException(
                    "Le taux de TVA sur commission doit être nul en mode commission nette"
            );
        }
        long overlaps = regleRepository.countOverlappingRules(
                agenceId,
                request.getCompagnieAssuranceId(),
                request.getTypeContrat(),
                request.getDateDebut(),
                request.getDateFin() != null ? request.getDateFin() : OPEN_ENDED_DATE,
                excludedId
        );
        if (Boolean.TRUE.equals(request.getActif()) && overlaps > 0) {
            throw new BadRequestException("Une règle active existe déjà sur cette période");
        }
    }

    private void validateAllocationPeriod(
            LocalDate dateEffet,
            LocalDate dateEcheance,
            Quittance quittance,
            String numeroQuittance
    ) {
        if (dateEffet == null) {
            throw new BadRequestException("La date d'effet de la quittance " + numeroQuittance + " est obligatoire");
        }
        LocalDate periodStart = resolveDateEffet(quittance);
        LocalDate periodEnd = resolveDateEcheance(quittance);
        if (periodStart == null || periodEnd == null) {
            throw new BadRequestException("La période de la quittance de production est incomplète");
        }
        if (dateEffet.isBefore(periodStart) || dateEffet.isAfter(periodEnd)) {
            throw new BadRequestException(
                    "La date d'effet de la quittance " + numeroQuittance + " est hors de la période de production"
            );
        }
        if (dateEcheance != null
                && (dateEcheance.isBefore(dateEffet) || dateEcheance.isAfter(periodEnd))) {
            throw new BadRequestException(
                    "La date d'échéance de la quittance " + numeroQuittance + " est invalide"
            );
        }
    }

    private void applyRule(
            RegleAffectationQuittance entity,
            UpsertRegleAffectationQuittanceRequest request
    ) {
        entity.setTypeContrat(request.getTypeContrat());
        entity.setModeAffectation(request.getModeAffectation());
        entity.setModeCalculCommission(request.getModeCalculCommission());
        entity.setTauxCommissionAutomobile(request.getTauxCommissionAutomobile());
        entity.setTauxCommissionEvcat(request.getTauxCommissionEvcat());
        entity.setTauxCommissionCorporel(request.getTauxCommissionCorporel());
        entity.setTauxTvaIncluseCommission(request.getTauxTvaIncluseCommission());
        entity.setRetenueParDefaut(request.getRetenueParDefaut());
        entity.setTauxRetenue(request.getTauxRetenue());
        entity.setDateDebut(request.getDateDebut());
        entity.setDateFin(request.getDateFin());
        entity.setActif(request.getActif());
    }

    private RegleAffectationQuittanceResponse toRuleResponse(RegleAffectationQuittance entity) {
        return RegleAffectationQuittanceResponse.builder()
                .id(entity.getId())
                .compagnieAssuranceId(entity.getCompagnieAssurance().getId())
                .compagnie(entity.getCompagnieAssurance().getNom())
                .typeContrat(entity.getTypeContrat())
                .modeAffectation(entity.getModeAffectation())
                .modeCalculCommission(entity.getModeCalculCommission())
                .tauxCommissionAutomobile(entity.getTauxCommissionAutomobile())
                .tauxCommissionEvcat(entity.getTauxCommissionEvcat())
                .tauxCommissionCorporel(entity.getTauxCommissionCorporel())
                .tauxTvaIncluseCommission(entity.getTauxTvaIncluseCommission())
                .retenueParDefaut(entity.getRetenueParDefaut())
                .tauxRetenue(entity.getTauxRetenue())
                .dateDebut(entity.getDateDebut())
                .dateFin(entity.getDateFin())
                .actif(entity.getActif())
                .build();
    }

    private RegleAffectationQuittance requireEffectiveRule(Long agenceId, Quittance quittance) {
        Long companyId = resolveCompagnieId(quittance);
        if (companyId == null) {
            throw new BadRequestException("La compagnie du contrat est obligatoire pour affecter la quittance");
        }
        LocalDate effectDate = resolveDateEffet(quittance);
        if (effectDate == null) {
            throw new BadRequestException("La date d'effet de la quittance est obligatoire");
        }
        List<RegleAffectationQuittance> rules = regleRepository.findEffectiveRules(
                agenceId,
                companyId,
                quittance.getContrat().getTypeContrat(),
                effectDate
        );
        if (rules.isEmpty()) {
            throw new BadRequestException(
                    "Aucune règle d'affectation active ne couvre cette compagnie, ce type de contrat et cette date d'effet"
            );
        }
        if (rules.size() > 1) {
            throw new BadRequestException("Plusieurs règles d'affectation couvrent cette quittance");
        }
        return rules.get(0);
    }

    private RegleAffectationQuittance findEffectiveRuleOrNull(
            List<RegleAffectationQuittance> rules,
            Quittance quittance
    ) {
        Long companyId = resolveCompagnieId(quittance);
        LocalDate effectDate = resolveDateEffet(quittance);
        if (companyId == null || effectDate == null) {
            return null;
        }
        return rules.stream()
                .filter(RegleAffectationQuittance::getActif)
                .filter(rule -> rule.getCompagnieAssurance().getId().equals(companyId))
                .filter(rule -> rule.getTypeContrat() == quittance.getContrat().getTypeContrat())
                .filter(rule -> !rule.getDateDebut().isAfter(effectDate))
                .filter(rule -> rule.getDateFin() == null || !rule.getDateFin().isBefore(effectDate))
                .max(Comparator.comparing(RegleAffectationQuittance::getDateDebut))
                .orElse(null);
    }

    private void validateMode(
            TypeContrat typeContrat,
            RegleAffectationQuittance regle,
            SourceAffectationQuittance source
    ) {
        if (typeContrat == TypeContrat.FLOTTE
                && (regle.getModeAffectation() != ModeAffectationQuittance.MANUEL_OU_IMPORT
                || source == SourceAffectationQuittance.AUTOMATIQUE)) {
            throw new BadRequestException("La flotte exige une affectation manuelle ou importée");
        }
        if (typeContrat != TypeContrat.FLOTTE
                && (regle.getModeAffectation() != ModeAffectationQuittance.AUTOMATIQUE
                || source != SourceAffectationQuittance.AUTOMATIQUE)) {
            throw new BadRequestException("Mono et Convention exigent une affectation automatique");
        }
    }

    private Map<Long, String> resolveSouscripteurs(Collection<Long> contratIds) {
        if (contratIds.isEmpty()) {
            return Map.of();
        }
        Map<Long, List<ContratClient>> grouped = contratClientRepository
                .findByContratIdInAndRole(contratIds, RoleClientContrat.SOUSCRIPTEUR)
                .stream()
                .collect(Collectors.groupingBy(item -> item.getContrat().getId()));
        Map<Long, String> result = new HashMap<>();
        grouped.forEach((contratId, clients) -> clients.stream()
                .sorted(Comparator.comparing(item -> !Boolean.TRUE.equals(item.getPrincipalPourRole())))
                .findFirst()
                .ifPresent(item -> result.put(contratId, item.getClient().getNomAffichage())));
        return result;
    }

    private Quittance requireQuittance(Long agenceId, Long quittanceId) {
        validateTenant(agenceId);
        return quittanceRepository.findByContratAgenceIdAndIdAndGlobaleTrue(agenceId, quittanceId)
                .orElseThrow(() -> new ResourceNotFoundException("Quittance", quittanceId));
    }

    private Agence requireAgence(Long agenceId) {
        validateTenant(agenceId);
        return agenceRepository.findById(agenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Agence", agenceId));
    }

    private CompagnieAssurance requireCompagnie(Long id) {
        return compagnieRepository.findById(id)
                .filter(company -> Boolean.TRUE.equals(company.getActif()))
                .orElseThrow(() -> new ResourceNotFoundException("Compagnie", id));
    }

    private CompagnieAssurance requireQuittanceCompagnie(Quittance quittance) {
        CompagnieAssurance company = quittance.getCompagnieAssurance();
        if (company == null) {
            throw new BadRequestException("La compagnie enregistrée sur la quittance est obligatoire");
        }
        return company;
    }

    private void validateTenant(Long agenceId) {
        if (agenceId == null) {
            throw new BadRequestException("Agence courante manquante");
        }
    }

    private StatutAffectationQuittance resolveStatus(
            BigDecimal expected,
            BigDecimal allocated
    ) {
        if (money(allocated).compareTo(money(expected)) == 0) {
            return StatutAffectationQuittance.AFFECTEE;
        }
        if (expected.signum() == allocated.signum() && allocated.abs().compareTo(expected.abs()) < 0) {
            return StatutAffectationQuittance.PARTIELLEMENT_AFFECTEE;
        }
        return StatutAffectationQuittance.AVEC_ECART;
    }

    private String movementLabel(Quittance quittance) {
        if (quittance.getMouvementContrat() != null
                && quittance.getMouvementContrat().getTypeMouvement() != null) {
            return quittance.getMouvementContrat().getTypeMouvement().getLibelle();
        }
        return firstNonBlank(quittance.getType(), "Quittance");
    }

    private String productLabel(Contrat contrat) {
        return switch (contrat.getTypeContrat()) {
            case PARTICULIER -> "Mono";
            case CONVENTION -> "Convention";
            case FLOTTE -> "Flotte";
        };
    }

    private LocalDate resolveDateEffet(Quittance quittance) {
        return quittance.getDateDebut();
    }

    private LocalDate resolveDateEcheance(Quittance quittance) {
        return quittance.getDateFin();
    }

    private Long resolveCompagnieId(Quittance quittance) {
        return requireQuittanceCompagnie(quittance).getId();
    }

    private String resolveCompagnieName(Quittance quittance) {
        return requireQuittanceCompagnie(quittance).getNom();
    }

    private void validatePercentage(BigDecimal value, String label) {
        if (value == null || value.signum() < 0 || value.compareTo(HUNDRED) > 0) {
            throw new BadRequestException(label + " doit être compris entre 0 et 100");
        }
    }

    private void requireAmount(BigDecimal value, String label) {
        if (value == null) {
            throw new BadRequestException(label + " est obligatoire");
        }
    }

    private BigDecimal percent(BigDecimal base, BigDecimal rate) {
        return requiredAmount(base, "Base de calcul")
                .multiply(requiredAmount(rate, "Taux de calcul"))
                .divide(HUNDRED, 8, RoundingMode.HALF_UP);
    }

    private BigDecimal requiredAmount(BigDecimal value, String label) {
        if (value == null) {
            throw new BadRequestException(label + " est obligatoire");
        }
        return value;
    }

    private BigDecimal money(BigDecimal value) {
        return requiredAmount(value, "Montant").setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal rate(BigDecimal value) {
        return requiredAmount(value, "Taux").setScale(4, RoundingMode.HALF_UP);
    }

    private <T> BigDecimal sum(List<T> values, Function<T, BigDecimal> getter) {
        return money(values.stream()
                .map(getter)
                .map(value -> requiredAmount(value, "Montant d'une ligne"))
                .reduce(ZERO, BigDecimal::add));
    }

    private <T> Set<Long> ids(Collection<T> values, Function<T, Long> getter) {
        return values.stream().map(getter).collect(Collectors.toSet());
    }

    private long countStatus(List<AffectationQuittanceResponse> rows, StatutAffectationQuittance status) {
        return rows.stream().filter(row -> row.getStatutAffectation() == status).count();
    }

    private String normalizeSearch(String value) {
        String normalized = trimToNull(value);
        return normalized != null ? normalized.toLowerCase(Locale.ROOT) : null;
    }

    private String normalizeHeader(String value) {
        String ascii = Normalizer.normalize(value == null ? "" : value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT);
        return ascii.replace("°", "o").replaceAll("[^a-z0-9]", "");
    }

    private String normalizeIdentifier(String value) {
        String normalized = trimToNull(value);
        return normalized == null ? null : normalized.replaceAll("[^A-Za-z0-9]", "").toUpperCase(Locale.ROOT);
    }

    private String cleanFileName(String value) {
        String normalized = trimToNull(value);
        if (normalized == null) {
            throw new BadRequestException("Le nom du fichier source est obligatoire");
        }
        return normalized.replace("\\", "_").replace("/", "_");
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            String normalized = trimToNull(value);
            if (normalized != null) {
                return normalized;
            }
        }
        return null;
    }

    private String trimToNull(String value) {
        if (value == null || value.trim().isEmpty()) {
            return null;
        }
        return value.trim();
    }

    private record Retention(BigDecimal rate, BigDecimal amount) {
    }

    private record ParsedImport(
            List<AffectationQuittanceResponse.Ligne> lines,
            List<String> errors
    ) {
    }
}
