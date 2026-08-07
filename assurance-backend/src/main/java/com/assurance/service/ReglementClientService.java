package com.assurance.service;

import com.assurance.dto.request.AnnulerReglementClientRequest;
import com.assurance.dto.request.ChangerStatutInstrumentReglementRequest;
import com.assurance.dto.request.CreerReglementClientRequest;
import com.assurance.dto.request.RemplacerInstrumentReglementRequest;
import com.assurance.dto.response.CreanceClientPageResponse;
import com.assurance.dto.response.InstrumentReglementPageResponse;
import com.assurance.dto.response.ReglementClientPageResponse;
import com.assurance.dto.response.ReglementClientResponse;
import com.assurance.dto.response.SourceDocumentClientPageResponse;
import com.assurance.dto.response.SourceDocumentClientResponse;
import com.assurance.entity.AffectationReglementClient;
import com.assurance.entity.Agence;
import com.assurance.entity.Client;
import com.assurance.entity.CompteTresorerie;
import com.assurance.entity.Contrat;
import com.assurance.entity.ContratClient;
import com.assurance.entity.DocumentClient;
import com.assurance.entity.ElementFacturable;
import com.assurance.entity.GroupeClient;
import com.assurance.entity.InstrumentReglementClient;
import com.assurance.entity.Quittance;
import com.assurance.entity.ReglementClient;
import com.assurance.entity.SequenceReglementClient;
import com.assurance.entity.Utilisateur;
import com.assurance.enums.ModeFacturationContrat;
import com.assurance.enums.ModeReglementClient;
import com.assurance.enums.RoleClientContrat;
import com.assurance.enums.StatutAffectationReglement;
import com.assurance.enums.StatutDocumentClient;
import com.assurance.enums.StatutInstrumentReglement;
import com.assurance.enums.StatutReglementClient;
import com.assurance.enums.TypeCompteTresorerie;
import com.assurance.enums.TypeContrat;
import com.assurance.enums.TypeDocumentClient;
import com.assurance.enums.TypePayeurPrime;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.AffectationReglementClientRepository;
import com.assurance.repository.AgenceRepository;
import com.assurance.repository.ContratClientRepository;
import com.assurance.repository.DocumentClientRepository;
import com.assurance.repository.ElementFacturableRepository;
import com.assurance.repository.InstrumentReglementClientRepository;
import com.assurance.repository.QuittanceRepository;
import com.assurance.repository.ReglementClientRepository;
import com.assurance.repository.SequenceReglementClientRepository;
import com.assurance.repository.UtilisateurRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ReglementClientService {

    private static final BigDecimal ZERO = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);

    private final DocumentClientService documentClientService;
    private final DocumentClientRepository documentClientRepository;
    private final ElementFacturableRepository elementRepository;
    private final AffectationReglementClientRepository allocationRepository;
    private final ReglementClientRepository reglementRepository;
    private final InstrumentReglementClientRepository instrumentRepository;
    private final SequenceReglementClientRepository sequenceRepository;
    private final QuittanceRepository quittanceRepository;
    private final ContratClientRepository contratClientRepository;
    private final AgenceRepository agenceRepository;
    private final UtilisateurRepository utilisateurRepository;
    private final TresorerieService tresorerieService;

    @Transactional(readOnly = true)
    public CreanceClientPageResponse searchReceivables(
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
        SourceDocumentClientPageResponse sources = documentClientService.searchSources(
                agenceId,
                payeurType,
                payeurId,
                brancheId,
                typeContrat,
                dateDu,
                dateAu,
                search,
                page,
                size
        );
        List<Long> elementIds = sources.getRows().stream()
                .map(SourceDocumentClientResponse::getElementFacturableId)
                .toList();
        Map<Long, AllocationAmounts> amounts = loadAllocationAmounts(elementIds);
        List<CreanceClientPageResponse.Ligne> rows = sources.getRows().stream()
                .filter(source -> !source.isDejaFacturee())
                .map(source -> toReceivable(source, amounts.getOrDefault(
                        source.getElementFacturableId(),
                        AllocationAmounts.empty()
                )))
                .filter(row -> row.getSoldeOuvert().signum() > 0
                        || row.getMontantEnAttente().signum() > 0)
                .toList();

        return CreanceClientPageResponse.builder()
                .summary(CreanceClientPageResponse.Summary.builder()
                        .total(sources.getSummary().getTotal())
                        .montantInitial(sum(rows, row -> row.getSource().getMontantTtc()))
                        .montantConfirme(sum(rows, CreanceClientPageResponse.Ligne::getMontantConfirme))
                        .montantEnAttente(sum(rows, CreanceClientPageResponse.Ligne::getMontantEnAttente))
                        .soldeOuvert(sum(rows, CreanceClientPageResponse.Ligne::getSoldeOuvert))
                        .build())
                .page(sources.getPage())
                .rows(rows)
                .build();
    }

    @Transactional(readOnly = true)
    public CreanceClientPageResponse searchInvoiceReceivables(
            Long agenceId,
            String payeurType,
            Long payeurId,
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
                TypeDocumentClient.FACTURE,
                StatutDocumentClient.EMIS,
                dateDu,
                dateAu,
                payeurType,
                payeurId,
                normalizeSearch(search),
                PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100))
        );
        List<Long> documentIds = result.getContent().stream()
                .map(DocumentClient::getId)
                .toList();
        Map<Long, AllocationAmounts> amounts = loadDocumentAllocationAmounts(documentIds);
        List<CreanceClientPageResponse.Ligne> rows = result.getContent().stream()
                .map(document -> toReceivable(
                        toInvoiceSource(document),
                        amounts.getOrDefault(document.getId(), AllocationAmounts.empty())
                ))
                .filter(row -> row.getSoldeOuvert().signum() > 0
                        || row.getMontantEnAttente().signum() > 0)
                .toList();

        return CreanceClientPageResponse.builder()
                .summary(CreanceClientPageResponse.Summary.builder()
                        .total(result.getTotalElements())
                        .montantInitial(sum(rows, row -> row.getSource().getMontantTtc()))
                        .montantConfirme(sum(rows, CreanceClientPageResponse.Ligne::getMontantConfirme))
                        .montantEnAttente(sum(rows, CreanceClientPageResponse.Ligne::getMontantEnAttente))
                        .soldeOuvert(sum(rows, CreanceClientPageResponse.Ligne::getSoldeOuvert))
                        .build())
                .page(SourceDocumentClientPageResponse.PageInfo.builder()
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
    public ReglementClientPageResponse searchPayments(
            Long agenceId,
            LocalDate dateDu,
            LocalDate dateAu,
            String search,
            int page,
            int size
    ) {
        Page<ReglementClient> result = reglementRepository.search(
                agenceId,
                dateDu,
                dateAu,
                normalizeSearch(search),
                PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100))
        );
        return ReglementClientPageResponse.builder()
                .page(SourceDocumentClientPageResponse.PageInfo.builder()
                        .number(result.getNumber())
                        .size(result.getSize())
                        .totalElements(result.getTotalElements())
                        .totalPages(result.getTotalPages())
                        .first(result.isFirst())
                        .last(result.isLast())
                        .build())
                .rows(result.getContent().stream().map(this::toResponse).toList())
                .build();
    }

    @Transactional(readOnly = true)
    public ReglementClientResponse detail(Long agenceId, Long paymentId) {
        return toResponse(findPayment(agenceId, paymentId));
    }

    @Transactional
    public ReglementClientResponse create(
            Long agenceId,
            Long userId,
            CreerReglementClientRequest request
    ) {
        List<CreerReglementClientRequest.Instrument> requestedInstruments = request.getInstruments();
        List<Long> elementIds = requestedInstruments.stream()
                .flatMap(instrument -> instrument.getAffectations().stream())
                .map(CreerReglementClientRequest.Affectation::getElementFacturableId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        List<Long> documentIds = requestedInstruments.stream()
                .flatMap(instrument -> instrument.getAffectations().stream())
                .map(CreerReglementClientRequest.Affectation::getDocumentClientId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (elementIds.isEmpty() && documentIds.isEmpty()) {
            throw new BadRequestException("Affectez au moins une créance au règlement");
        }

        List<ElementFacturable> elements = elementIds.isEmpty()
                ? List.of()
                : elementRepository.findClientDocumentSourcesForUpdate(agenceId, elementIds);
        if (elements.size() != elementIds.size()) {
            throw new BadRequestException("Une ou plusieurs créances sont introuvables ou annulées");
        }
        List<DocumentClient> documents = documentIds.isEmpty()
                ? List.of()
                : documentClientRepository.findIssuedInvoicesForUpdate(agenceId, documentIds);
        if (documents.size() != documentIds.size()) {
            throw new BadRequestException("Une ou plusieurs factures sont introuvables ou annulées");
        }
        Map<Long, ElementFacturable> elementsById = elements.stream()
                .collect(Collectors.toMap(ElementFacturable::getId, Function.identity()));
        Map<Long, DocumentClient> documentsById = documents.stream()
                .collect(Collectors.toMap(DocumentClient::getId, Function.identity()));
        Map<Long, Client> subscribers = loadSubscribers(elements);
        Payer payer = resolveCommonPayer(elements, documents, subscribers);
        validateRequestedPayer(request, payer);
        validateAllocations(requestedInstruments, elementsById, documentsById);

        Map<Long, AllocationAmounts> existingAmounts = loadAllocationAmounts(elementIds);
        Map<Long, AllocationAmounts> existingDocumentAmounts =
                loadDocumentAllocationAmounts(documentIds);
        Map<Long, BigDecimal> requestedByElement = requestedAmountsByElement(requestedInstruments);
        Map<Long, BigDecimal> requestedByDocument = requestedAmountsByDocument(requestedInstruments);
        requestedByElement.forEach((elementId, requestedAmount) -> {
            BigDecimal total = money(elementsById.get(elementId).getPrimeTotale());
            AllocationAmounts current = existingAmounts.getOrDefault(elementId, AllocationAmounts.empty());
            BigDecimal available = total.subtract(current.confirmed()).subtract(current.pending());
            if (requestedAmount.compareTo(available) > 0) {
                throw new BadRequestException("Le montant affecté dépasse le solde de la créance " + elementId);
            }
        });
        requestedByDocument.forEach((documentId, requestedAmount) -> {
            BigDecimal total = money(documentsById.get(documentId).getTotalDocument());
            AllocationAmounts current = existingDocumentAmounts.getOrDefault(
                    documentId,
                    AllocationAmounts.empty()
            );
            BigDecimal available = total.subtract(current.confirmed()).subtract(current.pending());
            if (requestedAmount.compareTo(available) > 0) {
                throw new BadRequestException(
                        "Le montant affecté dépasse le solde de la facture "
                                + documentsById.get(documentId).getNumero()
                );
            }
        });

        Agence agence = agenceRepository.findByIdForUpdate(agenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Agence", agenceId));
        Utilisateur user = utilisateurRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Utilisateur", userId));
        BigDecimal totalPayment = sumInstruments(requestedInstruments);
        BigDecimal totalAllocated = requestedByElement.values().stream()
                .reduce(ZERO, BigDecimal::add)
                .add(requestedByDocument.values().stream().reduce(ZERO, BigDecimal::add));
        if (totalAllocated.compareTo(totalPayment) > 0) {
            throw new BadRequestException("Le montant affecté dépasse le total des moyens de règlement");
        }

        ReglementClient payment = ReglementClient.builder()
                .agence(agence)
                .numero(nextNumber(agence, request.getDateReglement().getYear()))
                .dateReglement(request.getDateReglement())
                .clientPayeur(payer.client())
                .groupePayeur(payer.group())
                .payeurNom(payer.name())
                .statut(StatutReglementClient.VALIDE)
                .montantTotal(totalPayment)
                .montantNonAffecte(totalPayment.subtract(totalAllocated))
                .notes(trimToNull(request.getNotes()))
                .creePar(user)
                .build();

        for (CreerReglementClientRequest.Instrument requested : requestedInstruments) {
            InstrumentReglementClient instrument = buildInstrument(agence, payment, requested);
            payment.getInstruments().add(instrument);
            for (CreerReglementClientRequest.Affectation requestedAllocation : requested.getAffectations()) {
                AffectationReglementClient allocation = AffectationReglementClient.builder()
                        .instrument(instrument)
                        .elementFacturable(elementsById.get(requestedAllocation.getElementFacturableId()))
                        .documentClient(documentsById.get(requestedAllocation.getDocumentClientId()))
                        .montant(money(requestedAllocation.getMontant()))
                        .statut(instrument.getStatut() == StatutInstrumentReglement.CONFIRME
                                ? StatutAffectationReglement.CONFIRMEE
                                : StatutAffectationReglement.EN_ATTENTE)
                        .build();
                instrument.getAffectations().add(allocation);
            }
        }

        payment = reglementRepository.saveAndFlush(payment);
        for (InstrumentReglementClient instrument : payment.getInstruments()) {
            if (instrument.getStatut() == StatutInstrumentReglement.CONFIRME) {
                tresorerieService.recordInstrumentEntry(
                        instrument,
                        instrument.getCompteTresorerie(),
                        request.getDateReglement()
                );
            }
        }
        recalculatePaymentFlags(elementIds, documentIds);
        return toResponse(payment);
    }

    @Transactional
    public ReglementClientResponse changeInstrumentStatus(
            Long agenceId,
            Long instrumentId,
            ChangerStatutInstrumentReglementRequest request
    ) {
        InstrumentReglementClient instrument = instrumentRepository.findByIdAndAgenceId(instrumentId, agenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Instrument de règlement", instrumentId));
        if (instrument.getReglement().getStatut() == StatutReglementClient.ANNULE) {
            throw new BadRequestException("Le règlement est annulé");
        }
        LocalDate operationDate = request.getDateOperation() == null ? LocalDate.now() : request.getDateOperation();
        if (request.getStatut() == StatutInstrumentReglement.CONFIRME) {
            confirmInstrument(agenceId, instrument, request.getCompteTresorerieId(), operationDate);
        } else if (request.getStatut() == StatutInstrumentReglement.REJETE) {
            rejectInstrument(instrument, request.getMotif(), operationDate);
        } else {
            throw new BadRequestException("Cette transition de statut n'est pas autorisée");
        }
        instrument.setDateStatut(operationDate);
        instrument.setMotifStatut(trimToNull(request.getMotif()));
        instrumentRepository.save(instrument);
        refreshUnallocatedAmount(instrument.getReglement());
        recalculatePaymentFlags(instrument.getAffectations().stream()
                .map(AffectationReglementClient::getElementFacturable)
                .filter(Objects::nonNull)
                .map(ElementFacturable::getId)
                .distinct()
                .toList(), instrument.getAffectations().stream()
                .map(AffectationReglementClient::getDocumentClient)
                .filter(Objects::nonNull)
                .map(DocumentClient::getId)
                .distinct()
                .toList());
        return toResponse(instrument.getReglement());
    }

    @Transactional
    public ReglementClientResponse cancel(
            Long agenceId,
            Long paymentId,
            AnnulerReglementClientRequest request
    ) {
        ReglementClient payment = findPayment(agenceId, paymentId);
        if (payment.getStatut() == StatutReglementClient.ANNULE) {
            return toResponse(payment);
        }
        LocalDate operationDate = LocalDate.now();
        List<Long> elementIds = new ArrayList<>();
        List<Long> documentIds = new ArrayList<>();
        for (InstrumentReglementClient instrument : payment.getInstruments()) {
            elementIds.addAll(instrument.getAffectations().stream()
                    .map(AffectationReglementClient::getElementFacturable)
                    .filter(Objects::nonNull)
                    .map(ElementFacturable::getId)
                    .toList());
            documentIds.addAll(instrument.getAffectations().stream()
                    .map(AffectationReglementClient::getDocumentClient)
                    .filter(Objects::nonNull)
                    .map(DocumentClient::getId)
                    .toList());
            if (instrument.getStatut() == StatutInstrumentReglement.CONFIRME) {
                tresorerieService.reverseInstrumentEntry(instrument, request.getMotif(), operationDate);
            }
            instrument.setStatut(StatutInstrumentReglement.REJETE);
            instrument.setDateStatut(operationDate);
            instrument.setMotifStatut(request.getMotif());
            instrument.getAffectations().forEach(allocation ->
                    allocation.setStatut(StatutAffectationReglement.ANNULEE));
        }
        payment.setStatut(StatutReglementClient.ANNULE);
        payment.setDateAnnulation(LocalDateTime.now());
        payment.setMotifAnnulation(request.getMotif().trim());
        payment.setMontantNonAffecte(ZERO);
        reglementRepository.save(payment);
        recalculatePaymentFlags(
                elementIds.stream().distinct().toList(),
                documentIds.stream().distinct().toList()
        );
        return toResponse(payment);
    }

    @Transactional
    public ReglementClientResponse replaceInstrument(
            Long agenceId,
            Long instrumentId,
            RemplacerInstrumentReglementRequest request
    ) {
        InstrumentReglementClient replaced = instrumentRepository.findByIdAndAgenceId(
                        instrumentId,
                        agenceId
                )
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Instrument de règlement",
                        instrumentId
                ));
        if (replaced.getReglement().getStatut() == StatutReglementClient.ANNULE) {
            throw new BadRequestException("Le règlement est annulé");
        }
        if (replaced.getStatut() != StatutInstrumentReglement.REJETE) {
            throw new BadRequestException("Seul un instrument rejeté peut être remplacé");
        }
        if (money(request.getMontant()).compareTo(money(replaced.getMontant())) != 0) {
            throw new BadRequestException(
                    "Le remplacement doit conserver le montant de l'instrument rejeté"
            );
        }

        CreerReglementClientRequest.Instrument replacementRequest = new CreerReglementClientRequest.Instrument();
        replacementRequest.setMode(request.getMode());
        replacementRequest.setMontant(request.getMontant());
        replacementRequest.setDateInstrument(request.getDateInstrument());
        replacementRequest.setDateEcheance(request.getDateEcheance());
        replacementRequest.setReferenceInstrument(request.getReferenceInstrument());
        replacementRequest.setBanqueEmettrice(request.getBanqueEmettrice());
        replacementRequest.setCompteTresorerieId(request.getCompteTresorerieId());
        replacementRequest.setAffectations(replaced.getAffectations().stream()
                .map(this::copyReplacementAllocation)
                .toList());
        validateReplacementBalances(replaced.getAffectations());

        InstrumentReglementClient replacement = buildInstrument(
                replaced.getAgence(),
                replaced.getReglement(),
                replacementRequest
        );
        replacement.setInstrumentRemplace(replaced);
        replacement.setDateStatut(request.getDateInstrument() == null
                ? LocalDate.now() : request.getDateInstrument());
        replacementRequest.getAffectations().forEach(requestedAllocation ->
                replacement.getAffectations().add(AffectationReglementClient.builder()
                        .instrument(replacement)
                        .elementFacturable(requestedAllocation.getElementFacturableId() == null
                                ? null
                                : replaced.getAffectations().stream()
                                .map(AffectationReglementClient::getElementFacturable)
                                .filter(Objects::nonNull)
                                .filter(element -> element.getId().equals(
                                        requestedAllocation.getElementFacturableId()
                                ))
                                .findFirst()
                                .orElseThrow())
                        .documentClient(requestedAllocation.getDocumentClientId() == null
                                ? null
                                : replaced.getAffectations().stream()
                                .map(AffectationReglementClient::getDocumentClient)
                                .filter(Objects::nonNull)
                                .filter(document -> document.getId().equals(
                                        requestedAllocation.getDocumentClientId()
                                ))
                                .findFirst()
                                .orElseThrow())
                        .montant(money(requestedAllocation.getMontant()))
                        .statut(replacement.getStatut() == StatutInstrumentReglement.CONFIRME
                                ? StatutAffectationReglement.CONFIRMEE
                                : StatutAffectationReglement.EN_ATTENTE)
                        .build()));

        replaced.setStatut(StatutInstrumentReglement.REMPLACE);
        replaced.setDateStatut(LocalDate.now());
        replaced.setMotifStatut("Remplacé par un nouvel instrument");
        replaced.getReglement().getInstruments().add(replacement);
        ReglementClient payment = reglementRepository.saveAndFlush(replaced.getReglement());
        if (replacement.getStatut() == StatutInstrumentReglement.CONFIRME) {
            tresorerieService.recordInstrumentEntry(
                    replacement,
                    replacement.getCompteTresorerie(),
                    replacement.getDateStatut()
            );
        }
        refreshUnallocatedAmount(payment);
        recalculatePaymentFlags(
                replacement.getAffectations().stream()
                        .map(AffectationReglementClient::getElementFacturable)
                        .filter(Objects::nonNull)
                        .map(ElementFacturable::getId)
                        .toList(),
                replacement.getAffectations().stream()
                        .map(AffectationReglementClient::getDocumentClient)
                        .filter(Objects::nonNull)
                        .map(DocumentClient::getId)
                        .toList()
        );
        return toResponse(payment);
    }

    @Transactional(readOnly = true)
    public List<ReglementClientResponse.Instrument> pendingInstruments(Long agenceId) {
        return instrumentRepository.findByAgenceIdAndStatutOrderByDateEcheanceAscIdAsc(
                        agenceId,
                        StatutInstrumentReglement.EN_ATTENTE
                ).stream()
                .map(this::toInstrumentResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public InstrumentReglementPageResponse searchInstruments(
            Long agenceId,
            StatutInstrumentReglement status,
            LocalDate dateDu,
            LocalDate dateAu,
            String search,
            int page,
            int size
    ) {
        if (dateDu != null && dateAu != null && dateDu.isAfter(dateAu)) {
            throw new BadRequestException("La date de début doit précéder la date de fin");
        }
        Page<InstrumentReglementClient> result = instrumentRepository.searchByStatus(
                agenceId,
                status,
                dateDu,
                dateAu,
                search == null || search.isBlank() ? null : search.trim(),
                PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100))
        );
        return InstrumentReglementPageResponse.builder()
                .page(SourceDocumentClientPageResponse.PageInfo.builder()
                        .number(result.getNumber())
                        .size(result.getSize())
                        .totalElements(result.getTotalElements())
                        .totalPages(result.getTotalPages())
                        .first(result.isFirst())
                        .last(result.isLast())
                        .build())
                .rows(result.getContent().stream().map(this::toInstrumentRegisterResponse).toList())
                .build();
    }

    private ReglementClientResponse.Instrument toInstrumentRegisterResponse(
            InstrumentReglementClient instrument
    ) {
        return ReglementClientResponse.Instrument.builder()
                .id(instrument.getId())
                .reglementId(instrument.getReglement().getId())
                .numeroReglement(instrument.getReglement().getNumero())
                .payeurNom(instrument.getReglement().getPayeurNom())
                .mode(instrument.getMode())
                .statut(instrument.getStatut())
                .montant(instrument.getMontant())
                .dateInstrument(instrument.getDateInstrument())
                .dateEcheance(instrument.getDateEcheance())
                .dateStatut(instrument.getDateStatut())
                .referenceInstrument(instrument.getReferenceInstrument())
                .banqueEmettrice(instrument.getBanqueEmettrice())
                .compteTresorerieId(instrument.getCompteTresorerie() == null
                        ? null : instrument.getCompteTresorerie().getId())
                .compteTresorerie(instrument.getCompteTresorerie() == null
                        ? null : instrument.getCompteTresorerie().getLibelle())
                .affectations(List.of())
                .build();
    }

    private InstrumentReglementClient buildInstrument(
            Agence agence,
            ReglementClient payment,
            CreerReglementClientRequest.Instrument request
    ) {
        BigDecimal allocated = request.getAffectations().stream()
                .map(CreerReglementClientRequest.Affectation::getMontant)
                .map(this::money)
                .reduce(ZERO, BigDecimal::add);
        if (allocated.compareTo(money(request.getMontant())) > 0) {
            throw new BadRequestException("Une ventilation dépasse le montant de son moyen de règlement");
        }
        boolean cash = request.getMode() == ModeReglementClient.ESPECES;
        CompteTresorerie account = null;
        if (request.getCompteTresorerieId() != null) {
            account = tresorerieService.findAccount(agence.getId(), request.getCompteTresorerieId());
            if (!Boolean.TRUE.equals(account.getActif())) {
                throw new BadRequestException("Le compte de trésorerie sélectionné est inactif");
            }
        }
        if (cash && (account == null || account.getTypeCompte() != TypeCompteTresorerie.CAISSE)) {
            throw new BadRequestException("Un règlement en espèces doit être rattaché à une caisse active");
        }
        validateInstrumentReference(request);
        return InstrumentReglementClient.builder()
                .agence(agence)
                .reglement(payment)
                .mode(request.getMode())
                .statut(cash ? StatutInstrumentReglement.CONFIRME : StatutInstrumentReglement.EN_ATTENTE)
                .montant(money(request.getMontant()))
                .dateInstrument(request.getDateInstrument() == null
                        ? payment.getDateReglement() : request.getDateInstrument())
                .dateEcheance(request.getDateEcheance())
                .referenceInstrument(trimToNull(request.getReferenceInstrument()))
                .banqueEmettrice(trimToNull(request.getBanqueEmettrice()))
                .compteTresorerie(account)
                .dateStatut(payment.getDateReglement())
                .build();
    }

    private CreerReglementClientRequest.Affectation copyReplacementAllocation(
            AffectationReglementClient allocation
    ) {
        CreerReglementClientRequest.Affectation copy = new CreerReglementClientRequest.Affectation();
        copy.setElementFacturableId(allocation.getElementFacturable() == null
                ? null : allocation.getElementFacturable().getId());
        copy.setDocumentClientId(allocation.getDocumentClient() == null
                ? null : allocation.getDocumentClient().getId());
        copy.setMontant(allocation.getMontant());
        return copy;
    }

    private void validateReplacementBalances(List<AffectationReglementClient> allocations) {
        List<Long> elementIds = allocations.stream()
                .map(AffectationReglementClient::getElementFacturable)
                .filter(Objects::nonNull)
                .map(ElementFacturable::getId)
                .distinct()
                .toList();
        List<Long> documentIds = allocations.stream()
                .map(AffectationReglementClient::getDocumentClient)
                .filter(Objects::nonNull)
                .map(DocumentClient::getId)
                .distinct()
                .toList();
        Map<Long, AllocationAmounts> elementAmounts = loadAllocationAmounts(elementIds);
        Map<Long, AllocationAmounts> documentAmounts = loadDocumentAllocationAmounts(documentIds);
        for (AffectationReglementClient allocation : allocations) {
            if (allocation.getElementFacturable() != null) {
                ElementFacturable element = allocation.getElementFacturable();
                AllocationAmounts current = elementAmounts.getOrDefault(
                        element.getId(),
                        AllocationAmounts.empty()
                );
                BigDecimal available = money(element.getPrimeTotale())
                        .subtract(current.confirmed())
                        .subtract(current.pending());
                if (money(allocation.getMontant()).compareTo(available) > 0) {
                    throw new BadRequestException(
                            "La créance a été réglée depuis le rejet de l'instrument"
                    );
                }
            } else if (allocation.getDocumentClient() != null) {
                DocumentClient document = allocation.getDocumentClient();
                AllocationAmounts current = documentAmounts.getOrDefault(
                        document.getId(),
                        AllocationAmounts.empty()
                );
                BigDecimal available = money(document.getTotalDocument())
                        .subtract(current.confirmed())
                        .subtract(current.pending());
                if (money(allocation.getMontant()).compareTo(available) > 0) {
                    throw new BadRequestException(
                            "La facture a été réglée depuis le rejet de l'instrument"
                    );
                }
            }
        }
    }

    private void confirmInstrument(
            Long agenceId,
            InstrumentReglementClient instrument,
            Long accountId,
            LocalDate operationDate
    ) {
        if (instrument.getStatut() != StatutInstrumentReglement.EN_ATTENTE) {
            throw new BadRequestException("Seul un instrument en attente peut être confirmé");
        }
        if (accountId == null && instrument.getCompteTresorerie() == null) {
            throw new BadRequestException("Sélectionnez le compte bancaire ou la caisse créditée");
        }
        CompteTresorerie account = accountId == null
                ? instrument.getCompteTresorerie()
                : tresorerieService.findAccount(agenceId, accountId);
        TypeCompteTresorerie expectedType = instrument.getMode() == ModeReglementClient.ESPECES
                ? TypeCompteTresorerie.CAISSE : TypeCompteTresorerie.BANQUE;
        if (account.getTypeCompte() != expectedType || !Boolean.TRUE.equals(account.getActif())) {
            throw new BadRequestException("Le type de compte ne correspond pas au moyen de règlement");
        }
        instrument.setCompteTresorerie(account);
        instrument.setStatut(StatutInstrumentReglement.CONFIRME);
        instrument.getAffectations().forEach(allocation ->
                allocation.setStatut(StatutAffectationReglement.CONFIRMEE));
        instrumentRepository.saveAndFlush(instrument);
        tresorerieService.recordInstrumentEntry(instrument, account, operationDate);
    }

    private void rejectInstrument(
            InstrumentReglementClient instrument,
            String reason,
            LocalDate operationDate
    ) {
        if (instrument.getStatut() != StatutInstrumentReglement.EN_ATTENTE
                && instrument.getStatut() != StatutInstrumentReglement.CONFIRME) {
            throw new BadRequestException("Cet instrument ne peut pas être rejeté");
        }
        if (reason == null || reason.isBlank()) {
            throw new BadRequestException("Le motif du rejet est obligatoire");
        }
        if (instrument.getStatut() == StatutInstrumentReglement.CONFIRME) {
            tresorerieService.reverseInstrumentEntry(instrument, reason.trim(), operationDate);
        }
        instrument.setStatut(StatutInstrumentReglement.REJETE);
        instrument.getAffectations().forEach(allocation ->
                allocation.setStatut(StatutAffectationReglement.ANNULEE));
    }

    private void validateInstrumentReference(CreerReglementClientRequest.Instrument request) {
        if (Set.of(ModeReglementClient.CHEQUE, ModeReglementClient.EFFET,
                        ModeReglementClient.VIREMENT, ModeReglementClient.VERSEMENT_BANCAIRE)
                .contains(request.getMode())
                && (request.getReferenceInstrument() == null || request.getReferenceInstrument().isBlank())) {
            throw new BadRequestException("La référence du moyen de règlement est obligatoire");
        }
        if (request.getMode() == ModeReglementClient.EFFET && request.getDateEcheance() == null) {
            throw new BadRequestException("L'échéance de l'effet est obligatoire");
        }
    }

    private void validateAllocations(
            List<CreerReglementClientRequest.Instrument> instruments,
            Map<Long, ElementFacturable> elements,
            Map<Long, DocumentClient> documents
    ) {
        for (CreerReglementClientRequest.Instrument instrument : instruments) {
            Set<String> duplicates = instrument.getAffectations().stream()
                    .collect(Collectors.groupingBy(
                            this::allocationTargetKey,
                            Collectors.counting()
                    ))
                    .entrySet().stream()
                    .filter(entry -> entry.getValue() > 1)
                    .map(Map.Entry::getKey)
                    .collect(Collectors.toSet());
            if (!duplicates.isEmpty()) {
                throw new BadRequestException("Une créance ne peut apparaître deux fois dans le même moyen");
            }
            for (CreerReglementClientRequest.Affectation allocation : instrument.getAffectations()) {
                boolean hasElement = allocation.getElementFacturableId() != null;
                boolean hasDocument = allocation.getDocumentClientId() != null;
                if (hasElement == hasDocument) {
                    throw new BadRequestException(
                            "Une affectation doit cibler une créance directe ou une facture"
                    );
                }
                if (hasElement && !elements.containsKey(allocation.getElementFacturableId())) {
                    throw new BadRequestException(
                            "Créance introuvable: " + allocation.getElementFacturableId()
                    );
                }
                if (hasDocument && !documents.containsKey(allocation.getDocumentClientId())) {
                    throw new BadRequestException(
                            "Facture introuvable: " + allocation.getDocumentClientId()
                    );
                }
            }
        }
    }

    private String allocationTargetKey(CreerReglementClientRequest.Affectation allocation) {
        if (allocation.getElementFacturableId() != null) {
            return "E:" + allocation.getElementFacturableId();
        }
        if (allocation.getDocumentClientId() != null) {
            return "D:" + allocation.getDocumentClientId();
        }
        return "INVALID";
    }

    private Payer resolveCommonPayer(
            List<ElementFacturable> elements,
            List<DocumentClient> documents,
            Map<Long, Client> subscribers
    ) {
        List<Payer> payers = new ArrayList<>();
        elements.stream()
                .map(element -> resolvePayer(element.getContrat(), subscribers))
                .forEach(payers::add);
        documents.stream()
                .map(this::resolvePayer)
                .forEach(payers::add);
        Payer first = payers.get(0);
        if (payers.stream().anyMatch(payer -> !payer.key().equals(first.key()))) {
            throw new BadRequestException("Un règlement ne peut couvrir que les créances d'un même payeur");
        }
        return first;
    }

    private Payer resolvePayer(DocumentClient document) {
        if (document.getGroupePayeur() != null) {
            return new Payer(
                    "G:" + document.getGroupePayeur().getId(),
                    document.getClientPayeur(),
                    document.getGroupePayeur(),
                    document.getPayeurNom()
            );
        }
        if (document.getClientPayeur() == null) {
            throw new BadRequestException(
                    "Aucun payeur n'est défini pour la facture " + document.getNumero()
            );
        }
        return new Payer(
                "C:" + document.getClientPayeur().getId(),
                document.getClientPayeur(),
                null,
                document.getPayeurNom()
        );
    }

    private Payer resolvePayer(Contrat contract, Map<Long, Client> subscribers) {
        GroupeClient group = contract.getGroupeFacturation();
        boolean consolidated = group != null
                && (contract.getModeFacturation() == ModeFacturationContrat.CONSOLIDEE_GROUPE
                || contract.getTypePayeurPrime() == TypePayeurPrime.TRESORERIE_GROUPE);
        if (consolidated) {
            Client treasury = group.getClientTresorerie();
            String name = treasury == null ? group.getLibelle() : treasury.getNomAffichage();
            return new Payer("G:" + group.getId(), treasury, group, name);
        }
        Client payer = contract.getPayeurPrime();
        if (payer == null) {
            payer = subscribers.get(contract.getId());
        }
        if (payer == null) {
            throw new BadRequestException("Aucun payeur n'est défini pour le contrat " + contract.getNumeroDossier());
        }
        return new Payer("C:" + payer.getId(), payer, null, payer.getNomAffichage());
    }

    private void validateRequestedPayer(CreerReglementClientRequest request, Payer payer) {
        if (payer.group() != null) {
            if (!Objects.equals(request.getGroupePayeurId(), payer.group().getId())
                    || request.getClientPayeurId() != null) {
                throw new BadRequestException("Le groupe payeur ne correspond pas aux créances sélectionnées");
            }
        } else if (!Objects.equals(request.getClientPayeurId(), payer.client().getId())
                || request.getGroupePayeurId() != null) {
            throw new BadRequestException("Le client payeur ne correspond pas aux créances sélectionnées");
        }
    }

    private void validateOptionalPayer(String payeurType, Long payeurId) {
        if (payeurId == null) {
            return;
        }
        if (!"CLIENT".equals(payeurType) && !"GROUPE".equals(payeurType)) {
            throw new BadRequestException("Sélectionnez un payeur valide");
        }
    }

    private void validatePeriod(LocalDate dateDu, LocalDate dateAu) {
        if (dateDu != null && dateAu != null && dateDu.isAfter(dateAu)) {
            throw new BadRequestException("La date de début doit précéder la date de fin");
        }
    }

    private Map<Long, Client> loadSubscribers(Collection<ElementFacturable> elements) {
        List<Long> contractIds = elements.stream().map(element -> element.getContrat().getId()).distinct().toList();
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

    private Map<Long, BigDecimal> requestedAmountsByElement(
            List<CreerReglementClientRequest.Instrument> instruments
    ) {
        Map<Long, BigDecimal> result = new HashMap<>();
        instruments.forEach(instrument -> instrument.getAffectations().stream()
                .filter(allocation -> allocation.getElementFacturableId() != null)
                .forEach(allocation -> result.merge(
                        allocation.getElementFacturableId(),
                        money(allocation.getMontant()),
                        BigDecimal::add
                )));
        return result;
    }

    private Map<Long, BigDecimal> requestedAmountsByDocument(
            List<CreerReglementClientRequest.Instrument> instruments
    ) {
        Map<Long, BigDecimal> result = new HashMap<>();
        instruments.forEach(instrument -> instrument.getAffectations().stream()
                .filter(allocation -> allocation.getDocumentClientId() != null)
                .forEach(allocation -> result.merge(
                        allocation.getDocumentClientId(),
                        money(allocation.getMontant()),
                        BigDecimal::add
                )));
        return result;
    }

    private Map<Long, AllocationAmounts> loadAllocationAmounts(Collection<Long> elementIds) {
        if (elementIds.isEmpty()) {
            return Map.of();
        }
        Map<Long, AllocationAmounts> result = new HashMap<>();
        for (Object[] row : allocationRepository.sumByElementIds(elementIds)) {
            Long elementId = (Long) row[0];
            StatutAffectationReglement status = (StatutAffectationReglement) row[1];
            BigDecimal amount = money((BigDecimal) row[2]);
            AllocationAmounts current = result.getOrDefault(elementId, AllocationAmounts.empty());
            result.put(elementId, status == StatutAffectationReglement.CONFIRMEE
                    ? new AllocationAmounts(current.confirmed().add(amount), current.pending())
                    : new AllocationAmounts(current.confirmed(), current.pending().add(amount)));
        }
        return result;
    }

    private Map<Long, AllocationAmounts> loadDocumentAllocationAmounts(Collection<Long> documentIds) {
        if (documentIds.isEmpty()) {
            return Map.of();
        }
        Map<Long, AllocationAmounts> result = new HashMap<>();
        for (Object[] row : allocationRepository.sumByDocumentIds(documentIds)) {
            Long documentId = (Long) row[0];
            StatutAffectationReglement status = (StatutAffectationReglement) row[1];
            BigDecimal amount = money((BigDecimal) row[2]);
            AllocationAmounts current = result.getOrDefault(
                    documentId,
                    AllocationAmounts.empty()
            );
            result.put(documentId, status == StatutAffectationReglement.CONFIRMEE
                    ? new AllocationAmounts(current.confirmed().add(amount), current.pending())
                    : new AllocationAmounts(current.confirmed(), current.pending().add(amount)));
        }
        return result;
    }

    private SourceDocumentClientResponse toInvoiceSource(DocumentClient document) {
        String payerType = document.getGroupePayeur() == null ? "CLIENT" : "GROUPE";
        Long payerId = document.getGroupePayeur() == null
                ? document.getClientPayeur().getId()
                : document.getGroupePayeur().getId();
        return SourceDocumentClientResponse.builder()
                .documentClientId(document.getId())
                .mouvement("Facture client")
                .reference(document.getNumero())
                .dateEffet(document.getDateEmission())
                .dateEcheance(document.getDateEcheance())
                .payeurType(payerType)
                .payeurId(payerId)
                .payeurNom(document.getPayeurNom())
                .primeNette(money(document.getTotalDocument()))
                .taxes(ZERO)
                .accessoires(ZERO)
                .montantTtc(money(document.getTotalDocument()))
                .facturable(true)
                .build();
    }

    private CreanceClientPageResponse.Ligne toReceivable(
            SourceDocumentClientResponse source,
            AllocationAmounts amounts
    ) {
        BigDecimal total = money(source.getMontantTtc());
        BigDecimal open = total.subtract(amounts.confirmed()).subtract(amounts.pending()).max(ZERO);
        String status;
        if (amounts.confirmed().compareTo(total) >= 0) {
            status = "PAYEE";
        } else if (amounts.confirmed().add(amounts.pending()).compareTo(total) >= 0) {
            status = "COUVERTE_EN_ATTENTE";
        } else if (amounts.confirmed().signum() > 0 || amounts.pending().signum() > 0) {
            status = "PARTIELLEMENT_REGLEE";
        } else {
            status = "IMPAYEE";
        }
        return CreanceClientPageResponse.Ligne.builder()
                .source(source)
                .montantConfirme(amounts.confirmed())
                .montantEnAttente(amounts.pending())
                .soldeOuvert(open)
                .statut(status)
                .build();
    }

    private void refreshUnallocatedAmount(ReglementClient payment) {
        BigDecimal validInstrumentTotal = payment.getInstruments().stream()
                .filter(instrument -> instrument.getStatut() == StatutInstrumentReglement.CONFIRME
                        || instrument.getStatut() == StatutInstrumentReglement.EN_ATTENTE)
                .map(InstrumentReglementClient::getMontant)
                .map(this::money)
                .reduce(ZERO, BigDecimal::add);
        BigDecimal activeAllocations = payment.getInstruments().stream()
                .flatMap(instrument -> instrument.getAffectations().stream())
                .filter(allocation -> allocation.getStatut() != StatutAffectationReglement.ANNULEE)
                .map(AffectationReglementClient::getMontant)
                .map(this::money)
                .reduce(ZERO, BigDecimal::add);
        payment.setMontantNonAffecte(validInstrumentTotal.subtract(activeAllocations).max(ZERO));
        reglementRepository.save(payment);
    }

    private void recalculateQuittancePaymentFlags(Collection<Long> elementIds) {
        if (elementIds.isEmpty()) {
            return;
        }
        Map<Long, AllocationAmounts> amounts = loadAllocationAmounts(elementIds);
        List<Quittance> quittances = quittanceRepository.findGlobalByElementFacturableIds(elementIds);
        for (Quittance quittance : quittances) {
            Long elementId = quittance.getElementFacturable().getId();
            BigDecimal total = money(quittance.getElementFacturable().getPrimeTotale());
            BigDecimal confirmed = amounts.getOrDefault(elementId, AllocationAmounts.empty()).confirmed();
            quittance.setPayee(confirmed.compareTo(total) >= 0);
        }
        quittanceRepository.saveAll(quittances);
    }

    private void recalculatePaymentFlags(
            Collection<Long> elementIds,
            Collection<Long> documentIds
    ) {
        recalculateQuittancePaymentFlags(elementIds);
        if (documentIds.isEmpty()) {
            return;
        }
        Map<Long, AllocationAmounts> amounts = loadDocumentAllocationAmounts(documentIds);
        List<DocumentClient> documents = documentClientRepository.findAllById(documentIds);
        Map<Long, Boolean> paidByElement = new HashMap<>();
        for (DocumentClient document : documents) {
            BigDecimal confirmed = amounts.getOrDefault(
                    document.getId(),
                    AllocationAmounts.empty()
            ).confirmed();
            boolean paid = confirmed.compareTo(money(document.getTotalDocument())) >= 0;
            document.getLignes().stream()
                    .map(line -> line.getElementFacturable())
                    .filter(Objects::nonNull)
                    .forEach(element -> paidByElement.merge(element.getId(), paid, Boolean::logicalOr));
        }
        if (paidByElement.isEmpty()) {
            return;
        }
        List<Quittance> quittances = quittanceRepository.findGlobalByElementFacturableIds(
                paidByElement.keySet()
        );
        quittances.forEach(quittance -> quittance.setPayee(
                Boolean.TRUE.equals(paidByElement.get(quittance.getElementFacturable().getId()))
        ));
        quittanceRepository.saveAll(quittances);
    }

    private String nextNumber(Agence agency, int year) {
        SequenceReglementClient sequence = sequenceRepository.findByAgenceIdAndAnnee(agency.getId(), year)
                .orElseGet(() -> SequenceReglementClient.builder()
                        .agence(agency)
                        .annee(year)
                        .valeur(0L)
                        .build());
        sequence.setValeur(sequence.getValeur() + 1);
        sequenceRepository.save(sequence);
        return "REG-" + agency.getCode() + "-" + year + "-" + String.format(Locale.ROOT, "%06d", sequence.getValeur());
    }

    private ReglementClient findPayment(Long agenceId, Long paymentId) {
        return reglementRepository.findByIdAndAgenceId(paymentId, agenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Règlement client", paymentId));
    }

    private ReglementClientResponse toResponse(ReglementClient payment) {
        return ReglementClientResponse.builder()
                .id(payment.getId())
                .numero(payment.getNumero())
                .dateReglement(payment.getDateReglement())
                .clientPayeurId(payment.getClientPayeur() == null ? null : payment.getClientPayeur().getId())
                .groupePayeurId(payment.getGroupePayeur() == null ? null : payment.getGroupePayeur().getId())
                .payeurNom(payment.getPayeurNom())
                .statut(payment.getStatut())
                .montantTotal(payment.getMontantTotal())
                .montantNonAffecte(payment.getMontantNonAffecte())
                .notes(payment.getNotes())
                .creePar(payment.getCreePar().getFullName())
                .instruments(payment.getInstruments().stream().map(this::toInstrumentResponse).toList())
                .build();
    }

    private ReglementClientResponse.Instrument toInstrumentResponse(InstrumentReglementClient instrument) {
        return ReglementClientResponse.Instrument.builder()
                .id(instrument.getId())
                .reglementId(instrument.getReglement().getId())
                .numeroReglement(instrument.getReglement().getNumero())
                .payeurNom(instrument.getReglement().getPayeurNom())
                .mode(instrument.getMode())
                .statut(instrument.getStatut())
                .montant(instrument.getMontant())
                .dateInstrument(instrument.getDateInstrument())
                .dateEcheance(instrument.getDateEcheance())
                .dateStatut(instrument.getDateStatut())
                .referenceInstrument(instrument.getReferenceInstrument())
                .banqueEmettrice(instrument.getBanqueEmettrice())
                .compteTresorerieId(instrument.getCompteTresorerie() == null
                        ? null : instrument.getCompteTresorerie().getId())
                .compteTresorerie(instrument.getCompteTresorerie() == null
                        ? null : instrument.getCompteTresorerie().getLibelle())
                .affectations(instrument.getAffectations().stream()
                        .map(allocation -> ReglementClientResponse.Affectation.builder()
                                .id(allocation.getId())
                                .elementFacturableId(allocation.getElementFacturable() == null
                                        ? null : allocation.getElementFacturable().getId())
                                .documentClientId(allocation.getDocumentClient() == null
                                        ? null : allocation.getDocumentClient().getId())
                                .montant(allocation.getMontant())
                                .statut(allocation.getStatut())
                                .build())
                        .toList())
                .build();
    }

    private BigDecimal sumInstruments(List<CreerReglementClientRequest.Instrument> instruments) {
        return instruments.stream()
                .map(CreerReglementClientRequest.Instrument::getMontant)
                .map(this::money)
                .reduce(ZERO, BigDecimal::add);
    }

    private <T> BigDecimal sum(List<T> rows, Function<T, BigDecimal> extractor) {
        return rows.stream().map(extractor).map(this::money).reduce(ZERO, BigDecimal::add);
    }

    private BigDecimal money(BigDecimal value) {
        return (value == null ? BigDecimal.ZERO : value).setScale(2, RoundingMode.HALF_UP);
    }

    private String normalizeSearch(String value) {
        return value == null || value.isBlank() ? null : value.trim().toLowerCase(Locale.ROOT);
    }

    private String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private record AllocationAmounts(BigDecimal confirmed, BigDecimal pending) {
        private static AllocationAmounts empty() {
            return new AllocationAmounts(ZERO, ZERO);
        }
    }

    private record Payer(String key, Client client, GroupeClient group, String name) {
    }
}
