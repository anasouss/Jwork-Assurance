package com.assurance.service;

import com.assurance.dto.request.CreerDocumentClientRequest;
import com.assurance.dto.request.AnnulerDocumentClientRequest;
import com.assurance.dto.response.DocumentClientPageResponse;
import com.assurance.dto.response.DocumentClientResponse;
import com.assurance.dto.response.SourceDocumentClientPageResponse;
import com.assurance.dto.response.SourceDocumentClientResponse;
import com.assurance.entity.Agence;
import com.assurance.entity.AssistanceContrat;
import com.assurance.entity.Client;
import com.assurance.entity.Contrat;
import com.assurance.entity.ContratClient;
import com.assurance.entity.DocumentClient;
import com.assurance.entity.ElementFacturable;
import com.assurance.entity.GroupeClient;
import com.assurance.entity.LigneDocumentClient;
import com.assurance.entity.Quittance;
import com.assurance.entity.SequenceDocumentClient;
import com.assurance.enums.ModeFacturationContrat;
import com.assurance.enums.NatureElementFacturable;
import com.assurance.enums.RoleClientContrat;
import com.assurance.enums.StatutAffectationReglement;
import com.assurance.enums.StatutDocumentClient;
import com.assurance.enums.StatutElementFacturable;
import com.assurance.enums.StatutEcheanceFacturationConvention;
import com.assurance.enums.StatutMouvementContrat;
import com.assurance.enums.TypeContrat;
import com.assurance.enums.TypeDocumentClient;
import com.assurance.enums.TypePayeurPrime;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.AgenceRepository;
import com.assurance.repository.AffectationReglementClientRepository;
import com.assurance.repository.AssistanceContratRepository;
import com.assurance.repository.ContratClientRepository;
import com.assurance.repository.DocumentClientRepository;
import com.assurance.repository.ElementFacturableRepository;
import com.assurance.repository.LigneDocumentClientRepository;
import com.assurance.repository.QuittanceRepository;
import com.assurance.repository.SequenceDocumentClientRepository;
import com.assurance.repository.EcheanceFacturationConventionRepository;
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
    private final ElementFacturableRepository elementFacturableRepository;
    private final AssistanceContratRepository assistanceContratRepository;
    private final ContratClientRepository contratClientRepository;
    private final DocumentClientRepository documentClientRepository;
    private final LigneDocumentClientRepository ligneDocumentClientRepository;
    private final SequenceDocumentClientRepository sequenceDocumentClientRepository;
    private final AgenceRepository agenceRepository;
    private final EcheanceFacturationConventionRepository echeanceFacturationConventionRepository;
    private final AffectationReglementClientRepository affectationReglementClientRepository;

    @Transactional(readOnly = true)
    public SourceDocumentClientPageResponse searchSources(
            Long agenceId,
            String payeurType,
            Long payeurId,
            Long brancheId,
            TypeContrat typeContrat,
            LocalDate dateDu,
            LocalDate dateAu,
            String search,
            int page,
            int size
    ) {
        validateOptionalPayer(payeurType, payeurId);
        validatePeriod(dateDu, dateAu);
        Pageable pageable = PageRequest.of(normalizePage(page), normalizeSize(size));
        Page<ElementFacturable> result = elementFacturableRepository.searchForClientDocuments(
                agenceId,
                brancheId,
                typeContrat,
                dateDu,
                dateAu,
                payeurType,
                payeurId,
                normalizeSearch(search),
                pageable
        );

        List<Long> pageIds = result.getContent().stream().map(ElementFacturable::getId).toList();
        Map<Long, Quittance> quittances = loadQuittancesByElement(pageIds);
        Map<Long, AssistanceContrat> assistances = loadAssistancesByElement(pageIds);
        Map<Long, Client> subscribers = loadSubscribersFromContracts(result.getContent().stream()
                .map(ElementFacturable::getContrat)
                .toList());
        Set<Long> alreadyInvoiced = pageIds.isEmpty()
                ? Set.of()
                : new HashSet<>(ligneDocumentClientRepository.findElementFacturableIdsAlreadyIssued(
                        pageIds,
                        TypeDocumentClient.FACTURE,
                        StatutDocumentClient.EMIS
                ));
        List<SourceDocumentClientResponse> rows = result.getContent().stream()
                .map(element -> resolveSource(element, quittances, assistances))
                .map(source -> toSourceResponse(
                        source,
                        resolvePayer(source.element().getContrat(), subscribers),
                        subscribers.get(source.element().getContrat().getId()),
                        alreadyInvoiced
                ))
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
            String payeurType,
            Long payeurId,
            TypeDocumentClient type,
            StatutDocumentClient statut,
            LocalDate dateDu,
            LocalDate dateAu,
            String search,
            int page,
            int size
    ) {
        validateOptionalPayer(payeurType, payeurId);
        validatePeriod(dateDu, dateAu);
        Page<DocumentClient> result = documentClientRepository.search(
                agenceId,
                type,
                statut,
                dateDu,
                dateAu,
                payeurType,
                payeurId,
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
        List<Long> requestedIds = request.getElementFacturableIds().stream()
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (requestedIds.isEmpty()) {
            throw new BadRequestException("Sélectionnez au moins une écriture");
        }
        List<ElementFacturable> elements = elementFacturableRepository
                .findClientDocumentSourcesForUpdate(agenceId, requestedIds);
        if (elements.size() != requestedIds.size()) {
            throw new BadRequestException("Une ou plusieurs écritures sélectionnées sont introuvables");
        }
        Map<Long, Quittance> quittances = loadQuittancesByElement(requestedIds);
        Map<Long, AssistanceContrat> assistances = loadAssistancesByElement(requestedIds);
        List<BillableSource> sources = elements.stream()
                .map(element -> resolveSource(element, quittances, assistances))
                .toList();
        sources.forEach(this::validateSource);
        DocumentPeriod documentPeriod = deriveDocumentPeriod(sources);

        Map<Long, Client> subscribers = loadSubscribersFromContracts(sources.stream()
                .map(source -> source.element().getContrat())
                .toList());
        List<Payer> payers = sources.stream()
                .map(source -> resolvePayer(source.element().getContrat(), subscribers))
                .toList();
        String payerKey = payers.get(0).key();
        if (payers.stream().anyMatch(payer -> !payer.key().equals(payerKey))) {
            throw new BadRequestException("Les écritures sélectionnées doivent appartenir au même payeur");
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
                .periodeDebut(documentPeriod.start())
                .periodeFin(documentPeriod.end())
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

        List<BillableSource> orderedSources = sources.stream()
                .sorted(Comparator.comparing((BillableSource source) -> source.element().getDateDebut())
                        .thenComparing(source -> source.element().getId()))
                .toList();
        int order = 1;
        BigDecimal debit = ZERO;
        BigDecimal credit = ZERO;
        for (BillableSource source : orderedSources) {
            ElementFacturable element = source.element();
            BigDecimal ttc = money(element.getPrimeTotale());
            BigDecimal lineDebit = ttc.signum() > 0 ? ttc : ZERO;
            BigDecimal lineCredit = ttc.signum() < 0 ? ttc.abs() : ZERO;
            LigneDocumentClient line = LigneDocumentClient.builder()
                    .document(document)
                    .quittance(source.quittance())
                    .elementFacturable(element)
                    .ordre(order++)
                    .dateOperation(element.getDateDebut())
                    .dateEcheance(element.getDateFin())
                    .numeroDossier(element.getContrat().getNumeroDossier())
                    .numeroPolice(element.getContrat().getNumeroPolice())
                    .numeroQuittance(sourceReference(source))
                    .mouvement(sourceLabel(source))
                    .compagnie(sourceCompany(source))
                    .debit(lineDebit)
                    .credit(lineCredit)
                    .primeNette(money(element.getPrimeNette()))
                    .taxes(taxes(element))
                    .accessoires(accessories(element))
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
        if (document.getTypeDocument() == TypeDocumentClient.FACTURE
                && affectationReglementClientRepository.existsByDocumentClientIdAndStatutIn(
                        documentId,
                        Set.of(
                                StatutAffectationReglement.EN_ATTENTE,
                                StatutAffectationReglement.CONFIRMEE
                        )
                )) {
            throw new BadRequestException(
                    "Cette facture contient des règlements actifs. Annulez d'abord les règlements concernés"
            );
        }
        document.setStatut(StatutDocumentClient.ANNULE);
        document.setDateAnnulation(LocalDateTime.now());
        document.setMotifAnnulation(request.getMotif().trim());
        releaseConventionSchedules(document);
        return toResponse(documentClientRepository.save(document), true);
    }

    @Transactional
    public void delete(Long agenceId, Long documentId) {
        DocumentClient document = findDocument(agenceId, documentId);
        releaseConventionSchedules(document);
        documentClientRepository.delete(document);
    }

    @Transactional(readOnly = true)
    public DocumentClient findDocument(Long agenceId, Long documentId) {
        return documentClientRepository.findByAgenceIdAndId(agenceId, documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Document client", documentId));
    }

    @Transactional(readOnly = true)
    public Set<Long> findIssuedInvoiceElementIds(Collection<Long> elementIds) {
        if (elementIds.isEmpty()) {
            return Set.of();
        }
        return new HashSet<>(ligneDocumentClientRepository.findElementFacturableIdsAlreadyIssued(
                elementIds,
                TypeDocumentClient.FACTURE,
                StatutDocumentClient.EMIS
        ));
    }

    private void validateRequest(CreerDocumentClientRequest request) {
        if (request.getTypeDocument() == TypeDocumentClient.FACTURE) {
            if (request.getDateEcheance() == null) {
                throw new BadRequestException("La date d'échéance est obligatoire pour une facture");
            }
            if (request.getDateEcheance().isBefore(LocalDate.now())) {
                throw new BadRequestException("La date d'échéance ne peut pas être antérieure à la date d'émission");
            }
        }
    }

    private void validatePayer(String payeurType, Long payeurId) {
        if (payeurId == null || (!"CLIENT".equals(payeurType) && !"GROUPE".equals(payeurType))) {
            throw new BadRequestException("Sélectionnez un payeur valide");
        }
    }

    private void validateOptionalPayer(String payeurType, Long payeurId) {
        if (payeurId != null) {
            validatePayer(payeurType, payeurId);
        }
    }

    private void validateInvoiceSources(List<BillableSource> sources) {
        if (sources.stream().anyMatch(source -> money(source.element().getPrimeTotale()).signum() <= 0)) {
            throw new BadRequestException("Une facture ne peut contenir que des écritures débitrices");
        }
        Set<Long> alreadyInvoiced = new HashSet<>(ligneDocumentClientRepository
                .findElementFacturableIdsAlreadyIssued(
                sources.stream().map(source -> source.element().getId()).toList(),
                TypeDocumentClient.FACTURE,
                StatutDocumentClient.EMIS
        ));
        if (!alreadyInvoiced.isEmpty()) {
            throw new BadRequestException("Une ou plusieurs écritures figurent déjà sur une facture émise");
        }
        if (affectationReglementClientRepository.existsActiveByElementFacturableIds(
                sources.stream().map(source -> source.element().getId()).toList(),
                Set.of(
                        StatutAffectationReglement.EN_ATTENTE,
                        StatutAffectationReglement.CONFIRMEE
                )
        )) {
            throw new BadRequestException(
                    "Une ou plusieurs écritures possèdent déjà un règlement direct actif"
            );
        }
    }

    private void validateSource(BillableSource source) {
        ElementFacturable element = source.element();
        Contrat contract = element.getContrat();
        if (!Boolean.TRUE.equals(element.getActif()) || element.getStatut() == StatutElementFacturable.ANNULE) {
            throw new BadRequestException("L'écriture sélectionnée est annulée");
        }
        if (contract == null || Boolean.TRUE.equals(contract.getProspection())) {
            throw new BadRequestException("L'écriture sélectionnée n'appartient pas à un contrat validé");
        }
        if (contract.getTypeContrat() == TypeContrat.CONVENTION
                && "facture".equalsIgnoreCase(trimToNull(contract.getModeReglement()))) {
            throw new BadRequestException(
                    "Les conventions réglées sur facture doivent être traitées dans la facturation des conventions"
            );
        }
        if (element.getMouvementContrat() != null
                && element.getMouvementContrat().getStatut() != StatutMouvementContrat.VALIDE) {
            throw new BadRequestException("L'écriture est liée à un mouvement non validé");
        }
        if (element.getNature() == NatureElementFacturable.ASSISTANCE) {
            if (source.assistance() == null || !Boolean.TRUE.equals(source.assistance().getActif())) {
                throw new BadRequestException("L'assistance sélectionnée n'est plus active");
            }
            return;
        }
        Quittance quittance = source.quittance();
        if (quittance == null
                || !Boolean.TRUE.equals(quittance.getGlobale())
                || Boolean.TRUE.equals(quittance.getAlternative())
                || Boolean.TRUE.equals(quittance.getPayee())) {
            throw new BadRequestException("L'écriture assurance n'a pas de quittance globale valide");
        }
    }

    private DocumentPeriod deriveDocumentPeriod(List<BillableSource> sources) {
        LocalDate start = sources.stream()
                .map(BillableSource::element)
                .map(ElementFacturable::getDateDebut)
                .filter(Objects::nonNull)
                .min(LocalDate::compareTo)
                .orElseThrow(() -> new BadRequestException(
                        "Les écritures sélectionnées n'ont pas de date d'effet"
                ));
        LocalDate end = sources.stream()
                .map(BillableSource::element)
                .map(element -> element.getDateFin() == null ? element.getDateDebut() : element.getDateFin())
                .filter(Objects::nonNull)
                .max(LocalDate::compareTo)
                .orElse(start);
        return new DocumentPeriod(start, end);
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

    private Map<Long, Client> loadSubscribersFromContracts(Collection<Contrat> contracts) {
        Set<Long> contractIds = contracts.stream()
                .map(Contrat::getId)
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
            BillableSource source,
            Payer payer,
            Client subscriber,
            Set<Long> alreadyInvoiced
    ) {
        ElementFacturable element = source.element();
        Contrat contract = element.getContrat();
        BigDecimal ttc = money(element.getPrimeTotale());
        return SourceDocumentClientResponse.builder()
                .elementFacturableId(element.getId())
                .nature(element.getNature())
                .quittanceId(source.quittance() == null ? null : source.quittance().getId())
                .contratId(contract.getId())
                .mouvementId(element.getMouvementContrat() == null
                        ? null : element.getMouvementContrat().getId())
                .dossier(contract.getNumeroDossier())
                .police(contract.getNumeroPolice())
                .typeContrat(contract.getTypeContrat())
                .mouvement(sourceLabel(source))
                .reference(sourceReference(source))
                .compagnie(sourceCompany(source))
                .dateEffet(element.getDateDebut())
                .dateEcheance(element.getDateFin())
                .payeurType(payer.group() == null ? "CLIENT" : "GROUPE")
                .payeurId(payer.group() == null ? payer.client().getId() : payer.group().getId())
                .payeurNom(payer.name())
                .souscripteurId(subscriber == null ? null : subscriber.getId())
                .souscripteurNom(subscriber == null ? null : subscriber.getNomAffichage())
                .primeNette(money(element.getPrimeNette()))
                .taxes(taxes(element))
                .accessoires(accessories(element))
                .montantTtc(ttc)
                .dejaFacturee(alreadyInvoiced.contains(element.getId()))
                .facturable(ttc.signum() > 0 && !alreadyInvoiced.contains(element.getId()))
                .build();
    }

    private DocumentClientResponse toResponse(DocumentClient document, boolean includeLines) {
        List<DocumentClientResponse.Ligne> lines = includeLines
                ? document.getLignes().stream()
                .sorted(Comparator.comparing(LigneDocumentClient::getOrdre))
                .map(line -> DocumentClientResponse.Ligne.builder()
                        .id(line.getId())
                        .quittanceId(line.getQuittance() == null ? null : line.getQuittance().getId())
                        .elementFacturableId(line.getElementFacturable() == null
                                ? null : line.getElementFacturable().getId())
                        .nature(line.getElementFacturable() == null
                                ? null : line.getElementFacturable().getNature())
                        .echeanceFacturationConventionId(line.getEcheanceFacturationConvention() == null
                                ? null : line.getEcheanceFacturationConvention().getId())
                        .contratId(line.getQuittance() != null
                                ? line.getQuittance().getContrat().getId()
                                : line.getElementFacturable() == null
                                ? null
                                : line.getElementFacturable().getContrat().getId())
                        .mouvementId(line.getQuittance() != null
                                && line.getQuittance().getMouvementContrat() != null
                                ? line.getQuittance().getMouvementContrat().getId()
                                : line.getElementFacturable() != null
                                && line.getElementFacturable().getMouvementContrat() != null
                                ? line.getElementFacturable().getMouvementContrat().getId()
                                : null)
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
                .signatureDisponible(document.getAgence().getSignatureCheminStockage() != null
                        && !document.getAgence().getSignatureCheminStockage().isBlank())
                .lignes(lines)
                .build();
    }

    private void releaseConventionSchedules(DocumentClient document) {
        List<com.assurance.entity.EcheanceFacturationConvention> schedules =
                echeanceFacturationConventionRepository.findByDocumentClientId(document.getId());
        schedules.forEach(schedule -> {
            schedule.setDocumentClient(null);
            schedule.setStatut(StatutEcheanceFacturationConvention.A_FACTURER);
        });
        echeanceFacturationConventionRepository.saveAll(schedules);
    }

    private SourceDocumentClientPageResponse.PageInfo pageInfo(Page<?> page) {
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

    private Map<Long, Quittance> loadQuittancesByElement(Collection<Long> elementIds) {
        if (elementIds.isEmpty()) {
            return Map.of();
        }
        return quittanceRepository.findGlobalByElementFacturableIds(elementIds).stream()
                .collect(Collectors.toMap(
                        quittance -> quittance.getElementFacturable().getId(),
                        quittance -> quittance,
                        (current, candidate) -> candidate.getId() > current.getId() ? candidate : current
                ));
    }

    private Map<Long, AssistanceContrat> loadAssistancesByElement(Collection<Long> elementIds) {
        if (elementIds.isEmpty()) {
            return Map.of();
        }
        return assistanceContratRepository.findActiveByElementFacturableIds(elementIds).stream()
                .collect(Collectors.toMap(
                        assistance -> assistance.getElementFacturable().getId(),
                        assistance -> assistance,
                        (current, candidate) -> candidate.getId() > current.getId() ? candidate : current
                ));
    }

    private BillableSource resolveSource(
            ElementFacturable element,
            Map<Long, Quittance> quittances,
            Map<Long, AssistanceContrat> assistances
    ) {
        if (element.getNature() == NatureElementFacturable.ASSISTANCE) {
            AssistanceContrat assistance = assistances.get(element.getId());
            if (assistance == null) {
                throw new BadRequestException("L'écriture d'assistance " + element.getId() + " est incomplète");
            }
            return new BillableSource(element, null, assistance);
        }
        Quittance quittance = quittances.get(element.getId());
        if (quittance == null) {
            throw new BadRequestException("L'écriture assurance " + element.getId() + " n'a pas de quittance valide");
        }
        return new BillableSource(element, quittance, null);
    }

    private String sourceLabel(BillableSource source) {
        if (source.assistance() != null) {
            return "Assistance - " + firstNonBlank(
                    source.assistance().getProduit(),
                    source.element().getLibelle(),
                    "Produit d'assistance"
            );
        }
        return movementLabel(source.quittance());
    }

    private String sourceReference(BillableSource source) {
        if (source.assistance() != null) {
            return firstNonBlank(
                    source.assistance().getNumeroContratOuQuittance(),
                    source.element().getReferenceSource()
            );
        }
        return source.quittance().getNumeroQuittance();
    }

    private String sourceCompany(BillableSource source) {
        if (source.assistance() != null && source.assistance().getCompagnieAssistance() != null) {
            return source.assistance().getCompagnieAssistance().getNom();
        }
        if (source.element().getCompagnieAssurance() != null) {
            return source.element().getCompagnieAssurance().getNom();
        }
        return firstNonBlank(
                source.element().getContrat().getCompagnieAssurance() == null
                        ? null
                        : source.element().getContrat().getCompagnieAssurance().getNom(),
                "Compagnie non renseignée"
        );
    }

    private BigDecimal taxes(ElementFacturable source) {
        return money(money(source.getTaxe()).add(money(source.getTaxeParafiscale())));
    }

    private BigDecimal accessories(ElementFacturable source) {
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

    private record BillableSource(
            ElementFacturable element,
            Quittance quittance,
            AssistanceContrat assistance
    ) {
    }

    private record DocumentPeriod(LocalDate start, LocalDate end) {
    }
}
