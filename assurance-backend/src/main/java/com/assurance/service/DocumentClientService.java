package com.assurance.service;

import com.assurance.dto.request.CreerDocumentClientRequest;
import com.assurance.dto.request.AnnulerDocumentClientRequest;
import com.assurance.dto.response.DocumentClientPageResponse;
import com.assurance.dto.response.DocumentClientResponse;
import com.assurance.dto.response.SourceDocumentClientPageResponse;
import com.assurance.dto.response.SourceDocumentClientResponse;
import com.assurance.entity.Agence;
import com.assurance.entity.Client;
import com.assurance.entity.Contrat;
import com.assurance.entity.ContratClient;
import com.assurance.entity.DocumentClient;
import com.assurance.entity.GroupeClient;
import com.assurance.entity.LigneDocumentClient;
import com.assurance.entity.Quittance;
import com.assurance.entity.SequenceDocumentClient;
import com.assurance.enums.ModeFacturationContrat;
import com.assurance.enums.RoleClientContrat;
import com.assurance.enums.StatutDocumentClient;
import com.assurance.enums.StatutElementFacturable;
import com.assurance.enums.StatutMouvementContrat;
import com.assurance.enums.TypeContrat;
import com.assurance.enums.TypeDocumentClient;
import com.assurance.enums.TypePayeurPrime;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.AgenceRepository;
import com.assurance.repository.ContratClientRepository;
import com.assurance.repository.DocumentClientRepository;
import com.assurance.repository.LigneDocumentClientRepository;
import com.assurance.repository.QuittanceRepository;
import com.assurance.repository.SequenceDocumentClientRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DocumentClientService {

    private static final BigDecimal ZERO = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);

    private final QuittanceRepository quittanceRepository;
    private final ContratClientRepository contratClientRepository;
    private final DocumentClientRepository documentClientRepository;
    private final LigneDocumentClientRepository ligneDocumentClientRepository;
    private final SequenceDocumentClientRepository sequenceDocumentClientRepository;
    private final AgenceRepository agenceRepository;

    @Transactional(readOnly = true)
    public SourceDocumentClientPageResponse searchSources(
            Long agenceId,
            TypeContrat typeContrat,
            LocalDate dateDu,
            LocalDate dateAu,
            String search,
            int page,
            int size
    ) {
        validatePeriod(dateDu, dateAu);
        Pageable pageable = PageRequest.of(normalizePage(page), normalizeSize(size));
        Page<Quittance> result = quittanceRepository.searchForClientDocuments(
                agenceId,
                typeContrat,
                dateDu,
                dateAu,
                normalizeSearch(search),
                pageable
        );

        Map<Long, Client> subscribers = loadSubscribers(result.getContent());
        List<Long> pageIds = result.getContent().stream().map(Quittance::getId).toList();
        Set<Long> alreadyInvoiced = pageIds.isEmpty()
                ? Set.of()
                : new HashSet<>(ligneDocumentClientRepository.findQuittanceIdsAlreadyIssued(
                        pageIds,
                        TypeDocumentClient.FACTURE,
                        StatutDocumentClient.EMIS
                ));

        List<SourceDocumentClientResponse> rows = result.getContent().stream()
                .map(q -> toSourceResponse(q, resolvePayer(q.getContrat(), subscribers), alreadyInvoiced))
                .toList();

        return SourceDocumentClientPageResponse.builder()
                .summary(SourceDocumentClientPageResponse.Summary.builder()
                        .total(result.getTotalElements())
                        .build())
                .page(pageInfo(result))
                .rows(rows)
                .build();
    }

    @Transactional(readOnly = true)
    public DocumentClientPageResponse searchDocuments(
            Long agenceId,
            TypeDocumentClient type,
            StatutDocumentClient statut,
            LocalDate dateDu,
            LocalDate dateAu,
            String search,
            int page,
            int size
    ) {
        validatePeriod(dateDu, dateAu);
        Page<DocumentClient> result = documentClientRepository.search(
                agenceId,
                type,
                statut,
                dateDu,
                dateAu,
                normalizeSearch(search),
                PageRequest.of(normalizePage(page), normalizeSize(size))
        );
        return DocumentClientPageResponse.builder()
                .summary(DocumentClientPageResponse.Summary.builder()
                        .total(result.getTotalElements())
                        .build())
                .page(documentPageInfo(result))
                .rows(result.getContent().stream().map(document -> toResponse(document, false)).toList())
                .build();
    }

    @Transactional(readOnly = true)
    public DocumentClientResponse detail(Long agenceId, Long documentId) {
        return toResponse(findDocument(agenceId, documentId), true);
    }

    @Transactional
    public DocumentClientResponse create(Long agenceId, CreerDocumentClientRequest request) {
        validateRequest(request);
        List<Long> requestedIds = request.getQuittanceIds().stream()
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (requestedIds.isEmpty()) {
            throw new BadRequestException("Sélectionnez au moins une quittance");
        }
        List<Quittance> sources = quittanceRepository.findClientDocumentSources(agenceId, requestedIds);
        if (sources.size() != requestedIds.size()) {
            throw new BadRequestException("Une ou plusieurs quittances sélectionnées sont introuvables");
        }
        sources.forEach(this::validateSource);
        sources.forEach(source -> validateSourcePeriod(
                source,
                request.getPeriodeDebut(),
                request.getPeriodeFin()
        ));

        Map<Long, Client> subscribers = loadSubscribers(sources);
        List<Payer> payers = sources.stream()
                .map(source -> resolvePayer(source.getContrat(), subscribers))
                .toList();
        String payerKey = payers.get(0).key();
        if (payers.stream().anyMatch(payer -> !payer.key().equals(payerKey))) {
            throw new BadRequestException("Les quittances sélectionnées doivent appartenir au même payeur");
        }

        if (request.getTypeDocument() == TypeDocumentClient.FACTURE) {
            validateInvoiceSources(sources);
        }

        Agence agence = agenceRepository.findByIdForUpdate(agenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Agence", agenceId));
        LocalDate emissionDate = LocalDate.now();
        Payer payer = payers.get(0);
        DocumentClient document = DocumentClient.builder()
                .agence(agence)
                .typeDocument(request.getTypeDocument())
                .statut(StatutDocumentClient.EMIS)
                .numero(nextNumber(agence, request.getTypeDocument(), emissionDate.getYear()))
                .dateEmission(emissionDate)
                .periodeDebut(request.getPeriodeDebut())
                .periodeFin(request.getPeriodeFin())
                .dateEcheance(request.getDateEcheance())
                .clientPayeur(payer.client())
                .groupePayeur(payer.group())
                .payeurNom(payer.name())
                .payeurIdentifiant(payer.identifier())
                .payeurAdresse(payer.address())
                .totalDebit(ZERO)
                .totalCredit(ZERO)
                .totalDocument(ZERO)
                .notes(trimToNull(request.getNotes()))
                .build();

        List<Quittance> orderedSources = sources.stream()
                .sorted(Comparator.comparing(Quittance::getDateDebut).thenComparing(Quittance::getId))
                .toList();
        int order = 1;
        BigDecimal debit = ZERO;
        BigDecimal credit = ZERO;
        for (Quittance source : orderedSources) {
            BigDecimal ttc = money(source.getPrimeTotale());
            BigDecimal lineDebit = ttc.signum() > 0 ? ttc : ZERO;
            BigDecimal lineCredit = ttc.signum() < 0 ? ttc.abs() : ZERO;
            LigneDocumentClient line = LigneDocumentClient.builder()
                    .document(document)
                    .quittance(source)
                    .ordre(order++)
                    .dateOperation(source.getDateDebut())
                    .dateEcheance(source.getDateFin())
                    .numeroDossier(source.getContrat().getNumeroDossier())
                    .numeroPolice(source.getContrat().getNumeroPolice())
                    .numeroQuittance(source.getNumeroQuittance())
                    .mouvement(movementLabel(source))
                    .compagnie(source.getCompagnieAssurance().getNom())
                    .debit(lineDebit)
                    .credit(lineCredit)
                    .primeNette(money(source.getPrimeNette()))
                    .taxes(taxes(source))
                    .accessoires(accessories(source))
                    .montantTtc(ttc)
                    .build();
            document.getLignes().add(line);
            debit = debit.add(lineDebit);
            credit = credit.add(lineCredit);
        }
        document.setTotalDebit(money(debit));
        document.setTotalCredit(money(credit));
        document.setTotalDocument(money(debit.subtract(credit)));
        return toResponse(documentClientRepository.saveAndFlush(document), true);
    }

    @Transactional
    public DocumentClientResponse cancel(
            Long agenceId,
            Long documentId,
            AnnulerDocumentClientRequest request
    ) {
        DocumentClient document = findDocument(agenceId, documentId);
        if (document.getStatut() == StatutDocumentClient.ANNULE) {
            throw new BadRequestException("Ce document est déjà annulé");
        }
        document.setStatut(StatutDocumentClient.ANNULE);
        document.setDateAnnulation(LocalDateTime.now());
        document.setMotifAnnulation(request.getMotif().trim());
        return toResponse(documentClientRepository.save(document), true);
    }

    @Transactional(readOnly = true)
    public DocumentClient findDocument(Long agenceId, Long documentId) {
        return documentClientRepository.findByAgenceIdAndId(agenceId, documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Document client", documentId));
    }

    private void validateRequest(CreerDocumentClientRequest request) {
        validatePeriod(request.getPeriodeDebut(), request.getPeriodeFin());
        if (request.getTypeDocument() == TypeDocumentClient.FACTURE) {
            if (request.getDateEcheance() == null) {
                throw new BadRequestException("La date d'échéance est obligatoire pour une facture");
            }
            if (request.getDateEcheance().isBefore(LocalDate.now())) {
                throw new BadRequestException("La date d'échéance ne peut pas être antérieure à la date d'émission");
            }
        }
    }

    private void validateInvoiceSources(List<Quittance> sources) {
        if (sources.stream().anyMatch(source -> money(source.getPrimeTotale()).signum() <= 0)) {
            throw new BadRequestException("Une facture ne peut contenir que des quittances débitrices");
        }
        Set<Long> alreadyInvoiced = new HashSet<>(ligneDocumentClientRepository.findQuittanceIdsAlreadyIssued(
                sources.stream().map(Quittance::getId).toList(),
                TypeDocumentClient.FACTURE,
                StatutDocumentClient.EMIS
        ));
        if (!alreadyInvoiced.isEmpty()) {
            throw new BadRequestException("Une ou plusieurs quittances figurent déjà sur une facture émise");
        }
    }

    private void validateSource(Quittance source) {
        if (!Boolean.TRUE.equals(source.getGlobale()) || Boolean.TRUE.equals(source.getAlternative())) {
            throw new BadRequestException("La quittance sélectionnée n'est pas une quittance globale valide");
        }
        if (source.getMouvementContrat() != null
                && source.getMouvementContrat().getStatut() != StatutMouvementContrat.VALIDE) {
            throw new BadRequestException("La quittance est liée à un mouvement non validé");
        }
        if (source.getElementFacturable() != null
                && source.getElementFacturable().getStatut() == StatutElementFacturable.ANNULE) {
            throw new BadRequestException("La quittance sélectionnée est annulée");
        }
    }

    private void validateSourcePeriod(Quittance source, LocalDate periodStart, LocalDate periodEnd) {
        if (source.getDateDebut() == null
                || source.getDateDebut().isBefore(periodStart)
                || source.getDateDebut().isAfter(periodEnd)) {
            throw new BadRequestException(
                    "La période du document doit inclure la date d'effet de chaque quittance"
            );
        }
    }

    private String nextNumber(Agence agence, TypeDocumentClient type, int year) {
        SequenceDocumentClient sequence = sequenceDocumentClientRepository
                .findForUpdate(agence.getId(), type, year)
                .orElseGet(() -> sequenceDocumentClientRepository.saveAndFlush(
                        SequenceDocumentClient.builder()
                                .agence(agence)
                                .typeDocument(type)
                                .annee(year)
                                .prochaineValeur(1L)
                                .build()
                ));
        long current = sequence.getProchaineValeur();
        sequence.setProchaineValeur(current + 1);
        sequenceDocumentClientRepository.save(sequence);
        String prefix = type == TypeDocumentClient.RELEVE ? "REL" : "FAC";
        return "%s-%s-%d-%06d".formatted(prefix, agence.getCode(), year, current);
    }

    private Map<Long, Client> loadSubscribers(Collection<Quittance> sources) {
        Set<Long> contractIds = sources.stream()
                .map(source -> source.getContrat().getId())
                .collect(Collectors.toSet());
        if (contractIds.isEmpty()) {
            return Map.of();
        }
        Map<Long, Client> result = new HashMap<>();
        for (ContratClient link : contratClientRepository.findByContratIdInAndRole(
                contractIds,
                RoleClientContrat.SOUSCRIPTEUR
        )) {
            Client current = result.get(link.getContrat().getId());
            if (current == null || Boolean.TRUE.equals(link.getPrincipalPourRole())) {
                result.put(link.getContrat().getId(), link.getClient());
            }
        }
        return result;
    }

    private Payer resolvePayer(Contrat contract, Map<Long, Client> subscribers) {
        GroupeClient group = contract.getGroupeFacturation();
        boolean consolidated = group != null
                && (contract.getModeFacturation() == ModeFacturationContrat.CONSOLIDEE_GROUPE
                || contract.getTypePayeurPrime() == TypePayeurPrime.TRESORERIE_GROUPE);
        if (consolidated) {
            Client treasury = group.getClientTresorerie();
            String name = treasury == null ? group.getLibelle() : treasury.getNomAffichage();
            return new Payer(
                    "G:" + group.getId(),
                    treasury,
                    group,
                    firstNonBlank(name, group.getLibelle(), "Groupe client"),
                    firstNonBlank(group.getCode(), treasury == null ? null : clientIdentifier(treasury)),
                    treasury == null ? null : clientAddress(treasury)
            );
        }
        Client payer = contract.getPayeurPrime();
        if (payer == null) {
            payer = subscribers.get(contract.getId());
        }
        if (payer == null) {
            throw new BadRequestException("Aucun payeur n'est défini pour le contrat " + contract.getNumeroDossier());
        }
        return new Payer(
                "C:" + payer.getId(),
                payer,
                null,
                firstNonBlank(payer.getNomAffichage(), "Client"),
                clientIdentifier(payer),
                clientAddress(payer)
        );
    }

    private SourceDocumentClientResponse toSourceResponse(
            Quittance source,
            Payer payer,
            Set<Long> alreadyInvoiced
    ) {
        BigDecimal ttc = money(source.getPrimeTotale());
        return SourceDocumentClientResponse.builder()
                .quittanceId(source.getId())
                .contratId(source.getContrat().getId())
                .mouvementId(source.getMouvementContrat() == null ? null : source.getMouvementContrat().getId())
                .dossier(source.getContrat().getNumeroDossier())
                .police(source.getContrat().getNumeroPolice())
                .typeContrat(source.getContrat().getTypeContrat())
                .mouvement(movementLabel(source))
                .compagnie(source.getCompagnieAssurance().getNom())
                .dateEffet(source.getDateDebut())
                .dateEcheance(source.getDateFin())
                .payeurType(payer.group() == null ? "CLIENT" : "GROUPE")
                .payeurId(payer.group() == null ? payer.client().getId() : payer.group().getId())
                .payeurNom(payer.name())
                .primeNette(money(source.getPrimeNette()))
                .taxes(taxes(source))
                .accessoires(accessories(source))
                .montantTtc(ttc)
                .dejaFacturee(alreadyInvoiced.contains(source.getId()))
                .facturable(ttc.signum() > 0 && !alreadyInvoiced.contains(source.getId()))
                .build();
    }

    private DocumentClientResponse toResponse(DocumentClient document, boolean includeLines) {
        List<DocumentClientResponse.Ligne> lines = includeLines
                ? document.getLignes().stream()
                .sorted(Comparator.comparing(LigneDocumentClient::getOrdre))
                .map(line -> DocumentClientResponse.Ligne.builder()
                        .id(line.getId())
                        .quittanceId(line.getQuittance().getId())
                        .contratId(line.getQuittance().getContrat().getId())
                        .mouvementId(line.getQuittance().getMouvementContrat() == null
                                ? null
                                : line.getQuittance().getMouvementContrat().getId())
                        .ordre(line.getOrdre())
                        .dateOperation(line.getDateOperation())
                        .dateEcheance(line.getDateEcheance())
                        .numeroDossier(line.getNumeroDossier())
                        .numeroPolice(line.getNumeroPolice())
                        .numeroQuittance(line.getNumeroQuittance())
                        .mouvement(line.getMouvement())
                        .compagnie(line.getCompagnie())
                        .debit(line.getDebit())
                        .credit(line.getCredit())
                        .primeNette(line.getPrimeNette())
                        .taxes(line.getTaxes())
                        .accessoires(line.getAccessoires())
                        .montantTtc(line.getMontantTtc())
                        .build())
                .toList()
                : List.of();
        return DocumentClientResponse.builder()
                .id(document.getId())
                .typeDocument(document.getTypeDocument())
                .statut(document.getStatut())
                .numero(document.getNumero())
                .dateEmission(document.getDateEmission())
                .periodeDebut(document.getPeriodeDebut())
                .periodeFin(document.getPeriodeFin())
                .dateEcheance(document.getDateEcheance())
                .clientPayeurId(document.getClientPayeur() == null ? null : document.getClientPayeur().getId())
                .groupePayeurId(document.getGroupePayeur() == null ? null : document.getGroupePayeur().getId())
                .payeurNom(document.getPayeurNom())
                .payeurIdentifiant(document.getPayeurIdentifiant())
                .payeurAdresse(document.getPayeurAdresse())
                .totalDebit(document.getTotalDebit())
                .totalCredit(document.getTotalCredit())
                .totalDocument(document.getTotalDocument())
                .notes(document.getNotes())
                .dateAnnulation(document.getDateAnnulation())
                .motifAnnulation(document.getMotifAnnulation())
                .lignes(lines)
                .build();
    }

    private SourceDocumentClientPageResponse.PageInfo pageInfo(Page<Quittance> page) {
        return SourceDocumentClientPageResponse.PageInfo.builder()
                .number(page.getNumber())
                .size(page.getSize())
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .first(page.isFirst())
                .last(page.isLast())
                .build();
    }

    private DocumentClientPageResponse.PageInfo documentPageInfo(Page<DocumentClient> page) {
        return DocumentClientPageResponse.PageInfo.builder()
                .number(page.getNumber())
                .size(page.getSize())
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .first(page.isFirst())
                .last(page.isLast())
                .build();
    }

    private String movementLabel(Quittance source) {
        if (source.getMouvementContrat() == null) {
            return "Affaire nouvelle";
        }
        if (source.getMouvementContrat().getTypeMouvement() != null) {
            return source.getMouvementContrat().getTypeMouvement().getLibelle();
        }
        return firstNonBlank(source.getMouvementContrat().getNumeroMouvement(), "Mouvement");
    }

    private BigDecimal taxes(Quittance source) {
        return money(money(source.getTaxe()).add(money(source.getTaxeParafiscale())));
    }

    private BigDecimal accessories(Quittance source) {
        return money(money(source.getAccessoire()).add(money(source.getCnpac())));
    }

    private BigDecimal money(BigDecimal value) {
        return (value == null ? BigDecimal.ZERO : value).setScale(2, RoundingMode.HALF_UP);
    }

    private String clientIdentifier(Client client) {
        return firstNonBlank(client.getCodeClient(), client.getIce(), client.getRc(), client.getCin());
    }

    private String clientAddress(Client client) {
        String city = client.getVille() == null ? null : client.getVille().getNom();
        if (client.getAdresse() == null) {
            return city;
        }
        return city == null ? client.getAdresse() : client.getAdresse() + ", " + city;
    }

    private String normalizeSearch(String value) {
        String normalized = trimToNull(value);
        return normalized == null ? null : normalized.toLowerCase(Locale.ROOT);
    }

    private void validatePeriod(LocalDate start, LocalDate end) {
        if (start != null && end != null && end.isBefore(start)) {
            throw new BadRequestException("La date de fin doit être postérieure ou égale à la date de début");
        }
    }

    private int normalizePage(int page) {
        return Math.max(page, 0);
    }

    private int normalizeSize(int size) {
        return Math.min(Math.max(size, 10), 100);
    }

    private String trimToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    private record Payer(
            String key,
            Client client,
            GroupeClient group,
            String name,
            String identifier,
            String address
    ) {
    }
}
