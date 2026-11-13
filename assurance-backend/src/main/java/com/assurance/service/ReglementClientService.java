package com.assurance.service;

import com.assurance.activity.ActivityAction;
import com.assurance.activity.ActivityCommand;
import com.assurance.activity.ActivityModule;
import com.assurance.activity.ActivityRecordType;
import com.assurance.activity.ActivityReference;
import com.assurance.activity.ActivityValues;
import com.assurance.activity.BusinessActivityRecorder;
import com.assurance.activity.InvoiceActivity;
import com.assurance.activity.PaymentActivity;
import com.assurance.dto.request.AnnulerReglementClientRequest;
import com.assurance.dto.request.ChangerStatutInstrumentReglementRequest;
import com.assurance.dto.request.CreerReglementClientRequest;
import com.assurance.dto.request.RemplacerInstrumentReglementRequest;
import com.assurance.dto.request.RepresenterInstrumentReglementRequest;
import com.assurance.dto.request.SelectionCreancesClientRequest;
import com.assurance.dto.response.CreanceClientPageResponse;
import com.assurance.dto.response.DocumentClientResponse;
import com.assurance.dto.response.InstrumentReglementPageResponse;
import com.assurance.dto.response.ReglementClientPageResponse;
import com.assurance.dto.response.ReglementClientPolicyResponse;
import com.assurance.dto.response.ReglementClientResponse;
import com.assurance.dto.response.SourceDocumentClientPageResponse;
import com.assurance.dto.response.SourceDocumentClientResponse;
import com.assurance.entity.AffectationReglementClient;
import com.assurance.entity.Agence;
import com.assurance.entity.Banque;
import com.assurance.entity.Client;
import com.assurance.entity.CompteTresorerie;
import com.assurance.entity.Contrat;
import com.assurance.entity.ContratClient;
import com.assurance.entity.DocumentClient;
import com.assurance.entity.EcartReglementClient;
import com.assurance.entity.ElementFacturable;
import com.assurance.entity.GroupeClient;
import com.assurance.entity.InstrumentReglementClient;
import com.assurance.entity.LigneDocumentClient;
import com.assurance.entity.LigneReleveBancaire;
import com.assurance.entity.LigneBordereauRemise;
import com.assurance.entity.BordereauRemise;
import com.assurance.entity.MouvementTresorerie;
import com.assurance.entity.Quittance;
import com.assurance.entity.ReglementClient;
import com.assurance.entity.SequenceReglementClient;
import com.assurance.entity.Utilisateur;
import com.assurance.enums.ModeFacturationContrat;
import com.assurance.enums.ModeReglementClient;
import com.assurance.enums.ResolutionRejetBancaire;
import com.assurance.enums.StatutSuiviRejetBancaire;
import com.assurance.enums.TypeMouvementRejetBancaire;
import com.assurance.enums.NatureCaisseTresorerie;
import com.assurance.enums.RoleClientContrat;
import com.assurance.enums.StatutAffectationReglement;
import com.assurance.enums.StatutDocumentClient;
import com.assurance.enums.StatutInstrumentReglement;
import com.assurance.enums.StatutBordereauRemise;
import com.assurance.enums.StatutLigneBordereauRemise;
import com.assurance.enums.StatutReglementClient;
import com.assurance.enums.TypeCompteTresorerie;
import com.assurance.enums.TypeContrat;
import com.assurance.enums.TypeDocumentClient;
import com.assurance.enums.TypePayeurPrime;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.AffectationReglementClientRepository;
import com.assurance.repository.AssistanceContratRepository;
import com.assurance.repository.AgenceRepository;
import com.assurance.repository.ContratClientRepository;
import com.assurance.repository.DocumentClientRepository;
import com.assurance.repository.EcartReglementClientRepository;
import com.assurance.repository.ElementFacturableRepository;
import com.assurance.repository.InstrumentReglementClientRepository;
import com.assurance.repository.LigneDocumentClientRepository;
import com.assurance.repository.LigneBordereauRemiseRepository;
import com.assurance.repository.QuittanceRepository;
import com.assurance.repository.ReglementClientRepository;
import com.assurance.repository.SequenceReglementClientRepository;
import com.assurance.repository.UtilisateurRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.Supplier;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ReglementClientService {
    private final RejetBancaireSuiviService rejetSuiviService;

    private static final BigDecimal ZERO = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
    private static final BigDecimal DEFAULT_MAX_UNALLOCATED_CREDIT = new BigDecimal("100.00");
    private static final String MAX_UNALLOCATED_CREDIT_PARAMETER = "REGLEMENT_CLIENT_CREDIT_NON_AFFECTE_MAX";
    private static final long MAX_RECEIPT_SIZE = 30L * 1024L * 1024L;
    private static final Set<String> RECEIPT_CONTENT_TYPES = Set.of(
            MediaType.APPLICATION_PDF_VALUE,
            MediaType.IMAGE_JPEG_VALUE,
            MediaType.IMAGE_PNG_VALUE
    );
    private static final Set<ModeReglementClient> BANK_ACCOUNT_REQUIRED_MODES = Set.of(
            ModeReglementClient.VIREMENT,
            ModeReglementClient.VERSEMENT_BANCAIRE
    );
    private static final Set<ModeReglementClient> ORIGINATING_BANK_MODES = Set.of(
            ModeReglementClient.CHEQUE,
            ModeReglementClient.EFFET,
            ModeReglementClient.VIREMENT
    );

    private final DocumentClientService documentClientService;
    private final DocumentClientRepository documentClientRepository;
    private final ElementFacturableRepository elementRepository;
    private final AffectationReglementClientRepository allocationRepository;
    private final ReglementClientRepository reglementRepository;
    private final InstrumentReglementClientRepository instrumentRepository;
    private final AssistanceContratRepository assistanceRepository;
    private final LigneDocumentClientRepository documentLineRepository;
    private final SequenceReglementClientRepository sequenceRepository;
    private final QuittanceRepository quittanceRepository;
    private final ContratClientRepository contratClientRepository;
    private final AgenceRepository agenceRepository;
    private final UtilisateurRepository utilisateurRepository;
    private final TresorerieService tresorerieService;
    private final LigneBordereauRemiseRepository remittanceLineRepository;
    private final BanqueService banqueService;
    private final ParametreApplicationService parametreApplicationService;
    private final StorageLayoutService storageLayoutService;
    private final EcartReglementClientRepository ecartRepository;
    private final BusinessActivityRecorder businessActivityRecorder;

    @Transactional(readOnly = true)
    public ReglementClientPolicyResponse paymentPolicy(Long agenceId) {
        return ReglementClientPolicyResponse.builder()
                .creditNonAffecteMaximum(maxUnallocatedCredit(agenceId))
                .ecartReglementMaximum(maxSettlementAdjustment(agenceId))
                .build();
    }

    @Transactional
    public ReglementClientPolicyResponse updatePaymentPolicy(
            Long agenceId,
            BigDecimal creditNonAffecteMaximum
    ) {
        return updatePaymentPolicy(agenceId, creditNonAffecteMaximum, null);
    }

    @Transactional
    public ReglementClientPolicyResponse updatePaymentPolicy(Long agenceId, BigDecimal creditNonAffecteMaximum,
                                                             BigDecimal ecartReglementMaximum) {
        var before = paymentPolicyValues(paymentPolicy(agenceId));
        return businessActivityRecorder.perform(() -> updatePaymentPolicyRecord(agenceId, creditNonAffecteMaximum, ecartReglementMaximum),
                result -> new ActivityCommand(agenceId, ActivityModule.COMPTABILITE_CLIENT, ActivityAction.UPDATED,
                        "Paramètres des règlements clients modifiés", "CLIENT_PAYMENT_POLICY_UPDATE",
                        new ActivityReference(ActivityRecordType.PARAMETRE, "CLIENT_PAYMENT_POLICY", "Paramètres des règlements clients"),
                        List.of(), ActivityValues.changes(before, paymentPolicyValues(result))));
    }

    private Map<String, String> paymentPolicyValues(ReglementClientPolicyResponse policy) {
        return new ActivityValues().put("Crédit non affecté maximal", policy.getCreditNonAffecteMaximum())
                .put("Écart de règlement maximal", policy.getEcartReglementMaximum()).snapshot();
    }

    private ReglementClientPolicyResponse updatePaymentPolicyRecord(Long agenceId, BigDecimal creditNonAffecteMaximum,
            BigDecimal ecartReglementMaximum) {
        if (creditNonAffecteMaximum == null || creditNonAffecteMaximum.signum() < 0) {
            throw new BadRequestException("Le montant maximal restant à affecter doit être positif ou nul");
        }
        BigDecimal maximum = money(creditNonAffecteMaximum);
        if (ecartReglementMaximum != null && ecartReglementMaximum.signum() < 0) {
            throw new BadRequestException("Le plafond d'écart de règlement doit être positif ou nul");
        }
        parametreApplicationService.setValeur(
                agenceId,
                MAX_UNALLOCATED_CREDIT_PARAMETER,
                "DECIMAL",
                maximum.toPlainString(),
                "Montant maximal restant à affecter lors d'un règlement client"
        );
        if (ecartReglementMaximum != null) {
            parametreApplicationService.setValeur(agenceId, "REGLEMENT_CLIENT_ECART_MAX", "DECIMAL",
                    money(ecartReglementMaximum).toPlainString(), "Écart de règlement maximal accordé par règlement client");
        }
        return ReglementClientPolicyResponse.builder().creditNonAffecteMaximum(maximum)
                .ecartReglementMaximum(ecartReglementMaximum == null ? maxSettlementAdjustment(agenceId) : money(ecartReglementMaximum)).build();
    }

    @Transactional(readOnly = true)
    public CreanceClientPageResponse searchReceivables(
            Long agenceId,
            String payeurType,
            Long payeurId,
            Long souscripteurId,
            Long contratId,
            Long brancheId,
            Long compagnieId,
            Long compagnieAssistanceId,
            TypeContrat typeContrat,
            String typeDate,
            LocalDate dateDu,
            LocalDate dateAu,
            String search,
            String sortBy,
            String sortDirection,
            int page,
            int size
    ) {
        validatePeriod(dateDu, dateAu);
        boolean filterByEntryDate = isEntryDateFilter(typeDate);
        SourceDocumentClientPageResponse sources = documentClientService.searchSources(
                agenceId,
                payeurType,
                payeurId,
                contratId,
                brancheId,
                compagnieId,
                typeContrat,
                null,
                filterByEntryDate ? null : dateDu,
                filterByEntryDate ? null : dateAu,
                search,
                false,
                false,
                receivableSort(sortBy, sortDirection, false, filterByEntryDate),
                page,
                size,
                souscripteurId,
                compagnieAssistanceId,
                filterByEntryDate && dateDu != null ? dateDu.atStartOfDay() : null,
                filterByEntryDate && dateAu != null ? dateAu.plusDays(1).atStartOfDay() : null
        );
        List<Long> elementIds = sources.getRows().stream()
                .map(SourceDocumentClientResponse::getElementFacturableId)
                .toList();
        Map<Long, AllocationAmounts> amounts = loadAllocationAmounts(agenceId, elementIds);
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
            Long brancheId,
            Long compagnieId,
            Long compagnieAssistanceId,
            String typeDate,
            LocalDate dateDu,
            LocalDate dateAu,
            String search,
            String sortBy,
            String sortDirection,
            int page,
            int size
    ) {
        return searchInvoiceReceivables(agenceId, payeurType, payeurId, brancheId, compagnieId,
                compagnieAssistanceId, typeDate, dateDu, dateAu, search, sortBy, sortDirection,
                page, size, false, null, false);
    }

    @Transactional(readOnly = true)
    public CreanceClientPageResponse searchInvoiceReceivables(
            Long agenceId,
            String payeurType,
            Long payeurId,
            Long brancheId,
            Long compagnieId,
            Long compagnieAssistanceId,
            String typeDate,
            LocalDate dateDu,
            LocalDate dateAu,
            String search,
            String sortBy,
            String sortDirection,
            int page,
            int size,
            boolean conventionsOnly,
            Long conventionId,
            boolean includeSettled
    ) {
        validateOptionalPayer(payeurType, payeurId);
        validatePeriod(dateDu, dateAu);
        boolean filterByEntryDate = isEntryDateFilter(typeDate);
        Page<DocumentClient> result = documentClientRepository.searchOpenInvoices(
                agenceId,
                filterByEntryDate ? null : dateDu,
                filterByEntryDate ? null : dateAu,
                filterByEntryDate && dateDu != null ? dateDu.atStartOfDay() : null,
                filterByEntryDate && dateAu != null ? dateAu.plusDays(1).atStartOfDay() : null,
                brancheId,
                compagnieId,
                compagnieAssistanceId,
                payeurType,
                payeurId,
                normalizeSearch(search),
                conventionsOnly || conventionId != null,
                conventionId,
                includeSettled,
                PageRequest.of(
                        Math.max(page, 0),
                        Math.min(Math.max(size, 1), 100),
                        receivableSort(sortBy, sortDirection, true, filterByEntryDate)
                )
        );
        List<Long> documentIds = result.getContent().stream()
                .map(DocumentClient::getId)
                .toList();
        Map<Long, AllocationAmounts> amounts = loadDocumentAllocationAmounts(agenceId, documentIds);
        List<CreanceClientPageResponse.Ligne> rows = result.getContent().stream()
                .map(document -> toReceivable(
                        toInvoiceSource(document),
                        amounts.getOrDefault(document.getId(), AllocationAmounts.empty())
                ))
                .filter(row -> includeSettled || row.getSoldeOuvert().signum() > 0
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

    private Sort receivableSort(
            String sortBy,
            String sortDirection,
            boolean invoice,
            boolean entryDate
    ) {
        Sort.Direction direction = "ASC".equalsIgnoreCase(sortDirection)
                ? Sort.Direction.ASC
                : Sort.Direction.DESC;
        String property = "TTC".equalsIgnoreCase(sortBy)
                ? invoice ? "totalDocument" : "primeTotale"
                : entryDate ? "createdAt" : invoice ? "dateEmission" : "dateDebut";
        return Sort.by(direction, property).and(Sort.by(Sort.Direction.DESC, "id"));
    }

    private boolean isEntryDateFilter(String typeDate) {
        if (typeDate == null || typeDate.isBlank() || "EFFET".equalsIgnoreCase(typeDate)) {
            return false;
        }
        if ("SAISIE".equalsIgnoreCase(typeDate)) {
            return true;
        }
        throw new BadRequestException("Le type de date doit être SAISIE ou EFFET");
    }

    @Transactional(readOnly = true)
    public ReglementClientPageResponse searchPayments(
            Long agenceId,
            LocalDate dateDu,
            LocalDate dateAu,
            String payeurType,
            Long payeurId,
            StatutReglementClient statut,
            ModeReglementClient mode,
            StatutInstrumentReglement statutInstrument,
            String search,
            String sortBy,
            String sortDirection,
            int page,
            int size
    ) {
        validateOptionalPayer(payeurType, payeurId);
        Page<ReglementClient> result = reglementRepository.search(
                agenceId,
                dateDu,
                dateAu,
                payeurType,
                payeurId,
                statut,
                mode,
                statutInstrument,
                normalizeSearch(search),
                PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100),
                        Sort.by("asc".equalsIgnoreCase(sortDirection) ? Sort.Direction.ASC : Sort.Direction.DESC,
                                switch (sortBy) {
                                    case "numero", "payeurNom", "montantTotal", "statut" -> sortBy;
                                    default -> "dateReglement";
                                }).and(Sort.by(Sort.Direction.DESC, "id")))
        );
        Map<Long, LigneBordereauRemise> remittanceLines = remittanceLinesWithHistory(
                result.getContent().stream()
                        .flatMap(payment -> payment.getInstruments().stream())
                        .map(InstrumentReglementClient::getId)
                        .toList()
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
                .rows(result.getContent().stream()
                        .map(payment -> toResponse(payment, remittanceLines))
                        .toList())
                .build();
    }

    @Transactional(readOnly = true)
    public ReglementClientResponse detail(Long agenceId, Long paymentId) {
        ReglementClient payment = findPayment(agenceId, paymentId);
        return toResponse(payment).toBuilder().detail(paymentDetail(payment)).build();
    }

    @Transactional(readOnly = true)
    public InstrumentReglementPageResponse searchRecordedInstruments(
            Long agenceId, String reference, LocalDate dateDu, LocalDate dateAu,
            String payeurType, Long payeurId, ModeReglementClient mode,
            StatutInstrumentReglement statut, String sortBy, String sortDirection, int page, int size
    ) {
        validateOptionalPayer(payeurType, payeurId);
        String normalized = normalizeSearch(reference);
        if (normalized == null) {
            throw new BadRequestException("Renseignez une référence de moyen de règlement");
        }
        if (dateDu != null && dateAu != null && dateDu.isAfter(dateAu)) {
            throw new BadRequestException("La date de début doit précéder la date de fin");
        }
        String property = switch (sortBy == null ? "" : sortBy) {
            case "numero" -> "reglement.numero";
            case "payeurNom" -> "reglement.payeurNom";
            case "montantTotal" -> "montant";
            case "statut" -> "reglement.statut";
            default -> "reglement.dateReglement";
        };
        String pattern = "%" + normalized.replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%";
        Page<InstrumentReglementClient> result = instrumentRepository.searchRecordedReferences(
                agenceId, pattern, dateDu, dateAu, mode, statut, payeurType, payeurId,
                PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100),
                        Sort.by("asc".equalsIgnoreCase(sortDirection) ? Sort.Direction.ASC : Sort.Direction.DESC, property)
                                .and(Sort.by(Sort.Direction.DESC, "id")))
        );
        Map<Long, LigneBordereauRemise> remittances = remittanceLinesWithHistory(
                result.getContent().stream().map(InstrumentReglementClient::getId).toList());
        return InstrumentReglementPageResponse.builder()
                .page(SourceDocumentClientPageResponse.PageInfo.builder()
                        .number(result.getNumber()).size(result.getSize()).totalElements(result.getTotalElements())
                        .totalPages(result.getTotalPages()).first(result.isFirst()).last(result.isLast()).build())
                .rows(result.getContent().stream()
                        .map(instrument -> toInstrumentRegisterResponse(instrument, remittances.get(instrument.getId())))
                        .toList())
                .build();
    }

    @Transactional
    public DocumentClientResponse createInvoiceFromPayment(Long agenceId, Long paymentId) {
        ReglementClient payment = reglementRepository.findByIdAndAgenceIdForUpdate(paymentId, agenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Règlement client", paymentId));
        loadPaymentInstruments(payment, agenceId);
        Map<String, String> before = PaymentActivity.snapshot(payment);
        return businessActivityRecorder.perform(() -> createInvoiceFromPaymentRecord(agenceId, payment), result -> {
            businessActivityRecorder.record(PaymentActivity.command(payment, before, ActivityAction.UPDATED,
                    "Affectations transférées sur la facture", "PAYMENT_ALLOCATION_INVOICING", null));
            return InvoiceActivity.command(documentClientService.findDocument(agenceId, result.getId()), Map.of(),
                    ActivityAction.ISSUED, "Facture émise depuis un règlement", "CLIENT_INVOICE_FROM_PAYMENT",
                    List.of(PaymentActivity.reference(payment)));
        });
    }

    private DocumentClientResponse createInvoiceFromPaymentRecord(Long agenceId, ReglementClient payment) {
        Long paymentId = payment.getId();
        if (payment.getStatut() != StatutReglementClient.VALIDE) {
            throw new BadRequestException("Seul un règlement enregistré peut être facturé");
        }
        if (Boolean.TRUE.equals(payment.getMultiPayeur())) {
            throw new BadRequestException(
                    "Créez les factures séparément pour chaque client d'un versement multi-clients"
            );
        }

        Set<StatutAffectationReglement> activeStatuses = Set.of(
                StatutAffectationReglement.EN_ATTENTE,
                StatutAffectationReglement.CONFIRMEE
        );
        List<Long> elementIds = payment.getInstruments().stream()
                .flatMap(instrument -> instrument.getAffectations().stream())
                .filter(allocation -> allocation.getElementFacturable() != null)
                .filter(allocation -> activeStatuses.contains(allocation.getStatut()))
                .map(allocation -> allocation.getElementFacturable().getId())
                .distinct()
                .toList();
        if (elementIds.isEmpty()) {
            throw new BadRequestException(
                    "Ce règlement ne contient aucune écriture directe à facturer"
            );
        }

        List<ElementFacturable> lockedElements = elementRepository
                .findClientDocumentSourcesForUpdate(agenceId, elementIds);
        if (lockedElements.size() != elementIds.size()) {
            throw new BadRequestException("Une ou plusieurs écritures ne sont plus facturables");
        }
        if (allocationRepository.existsActiveDirectByElementIdsFromOtherPayment(
                agenceId,
                paymentId,
                elementIds,
                activeStatuses
        )) {
            throw new BadRequestException(
                    "Une écriture est répartie sur plusieurs règlements. "
                            + "La facture ne peut pas être créée depuis un seul règlement"
            );
        }
        List<AffectationReglementClient> directAllocations = allocationRepository
                .findActiveDirectByPaymentAndElementIdsForUpdate(
                        agenceId,
                        paymentId,
                        elementIds,
                        activeStatuses
                );
        if (directAllocations.isEmpty()) {
            throw new BadRequestException("Les écritures ne sont plus réglées directement");
        }

        DocumentClientResponse invoice = documentClientService.createInvoiceFromDirectPayment(
                agenceId,
                elementIds
        );
        DocumentClient document = documentClientRepository.findByAgenceIdAndId(agenceId, invoice.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Document client", invoice.getId()));

        Map<InstrumentReglementClient, List<AffectationReglementClient>> byInstrument =
                directAllocations.stream().collect(Collectors.groupingBy(
                        AffectationReglementClient::getInstrument,
                        LinkedHashMap::new,
                        Collectors.toList()
                ));
        List<AffectationReglementClient> invoiceAllocations = new ArrayList<>();
        byInstrument.forEach((instrument, allocations) -> {
            StatutAffectationReglement status = allocations.stream()
                    .anyMatch(allocation -> allocation.getStatut()
                            == StatutAffectationReglement.CONFIRMEE)
                    ? StatutAffectationReglement.CONFIRMEE
                    : StatutAffectationReglement.EN_ATTENTE;
            BigDecimal amount = allocations.stream()
                    .map(AffectationReglementClient::getMontant)
                    .map(this::money)
                    .reduce(ZERO, BigDecimal::add);
            allocations.forEach(allocation -> allocation.setStatut(
                    StatutAffectationReglement.ANNULEE
            ));
            AffectationReglementClient invoiceAllocation = AffectationReglementClient.builder()
                    .instrument(instrument)
                    .documentClient(document)
                    .clientPayeur(document.getGroupePayeur() == null ? document.getClientPayeur() : null)
                    .groupePayeur(document.getGroupePayeur())
                    .payeurNomSnapshot(document.getPayeurNom())
                    .montant(amount)
                    .statut(status)
                    .build();
            instrument.getAffectations().add(invoiceAllocation);
            invoiceAllocations.add(invoiceAllocation);
        });
        allocationRepository.saveAll(directAllocations);
        allocationRepository.saveAll(invoiceAllocations);
        recalculatePaymentFlags(agenceId, elementIds, List.of(document.getId()));
        return documentClientService.detail(agenceId, document.getId());
    }

    @Transactional(readOnly = true)
    public List<CreanceClientPageResponse.Ligne> selectedReceivables(
            Long agenceId,
            SelectionCreancesClientRequest request
    ) {
        List<Long> elementIds = distinctIds(request.getElementFacturableIds());
        List<Long> documentIds = distinctIds(request.getDocumentClientIds());
        if (elementIds.isEmpty() && documentIds.isEmpty()) {
            throw new BadRequestException("Sélectionnez au moins une créance");
        }

        List<SourceDocumentClientResponse> directSources = documentClientService
                .findSourcesByIds(agenceId, elementIds);
        if (directSources.stream().anyMatch(SourceDocumentClientResponse::isDejaFacturee)) {
            throw new BadRequestException(
                    "Une ou plusieurs créances figurent désormais sur une facture émise"
            );
        }
        List<DocumentClient> documents = documentIds.isEmpty()
                ? List.of()
                : documentClientRepository.findIssuedInvoices(agenceId, documentIds);
        if (documents.size() != documentIds.size()) {
            throw new BadRequestException("Une ou plusieurs factures sont introuvables ou annulées");
        }
        Map<Long, DocumentClient> documentsById = documents.stream()
                .collect(Collectors.toMap(DocumentClient::getId, Function.identity()));

        Map<Long, AllocationAmounts> directAmounts = loadAllocationAmounts(agenceId, elementIds);
        List<CreanceClientPageResponse.Ligne> rows = new ArrayList<>();
        directSources.stream()
                .map(source -> toReceivable(
                        source,
                        directAmounts.getOrDefault(
                                source.getElementFacturableId(),
                                AllocationAmounts.empty()
                        )
                ))
                .forEach(rows::add);
        documentIds.stream().map(documentsById::get).forEach(document -> {
            Map<Long, AllocationAmounts> lineAmounts = invoiceLineAllocationAmounts(document);
            document.getLignes().stream()
                    .sorted(java.util.Comparator.comparing(LigneDocumentClient::getOrdre))
                    .map(line -> toReceivable(
                            toInvoiceLineSource(document, line),
                            lineAmounts.getOrDefault(
                                    line.getElementFacturable().getId(),
                                    AllocationAmounts.empty()
                            )
                    ))
                    .filter(row -> row.getSoldeOuvert().signum() > 0)
                    .forEach(rows::add);
        });

        if (rows.isEmpty()
                || rows.stream().anyMatch(row -> row.getSoldeOuvert().signum() <= 0)) {
            throw new BadRequestException(
                    "Une ou plusieurs créances ne présentent plus de solde disponible"
            );
        }
        Set<String> payers = rows.stream()
                .map(row -> row.getSource().getPayeurType() + ":" + row.getSource().getPayeurId())
                .collect(Collectors.toSet());
        if (!Boolean.TRUE.equals(request.getMultiPayeur()) && payers.size() != 1) {
            throw new BadRequestException("Les créances sélectionnées doivent appartenir au même payeur");
        }
        return rows;
    }

    @Transactional
    public ReglementClientResponse create(
            Long agenceId,
            Long userId,
            CreerReglementClientRequest request
    ) {
        if (Boolean.TRUE.equals(request.getMultiPayeur())) {
            throw new BadRequestException(
                    "Utilisez l'enregistrement de versement bancaire avec son justificatif"
            );
        }
        return businessActivityRecorder.perform(() -> savePayment(agenceId, userId, request, null), result ->
                PaymentActivity.command(findPayment(agenceId, result.getId()), Map.of(), ActivityAction.CREATED,
                        "Règlement client enregistré", "CLIENT_PAYMENT_CREATION", null));
    }

    @Transactional
    public ReglementClientResponse createDirectDeposit(
            Long agenceId,
            Long userId,
            CreerReglementClientRequest request,
            MultipartFile receipt
    ) {
        request.setMultiPayeur(true);
        validateReceipt(receipt, true);
        return businessActivityRecorder.perform(() -> savePayment(agenceId, userId, request, receipt), result ->
                PaymentActivity.command(findPayment(agenceId, result.getId()), Map.of(), ActivityAction.CREATED,
                        "Versement multi-clients enregistré", "MULTI_CLIENT_DEPOSIT_CREATION", null));
    }

    @Transactional(readOnly = true)
    public DownloadedReceipt downloadReceipt(Long agenceId, Long paymentId) {
        ReglementClient payment = findPayment(agenceId, paymentId);
        if (payment.getBordereauCheminStockage() == null) {
            throw new ResourceNotFoundException("BordereauVersement", paymentId);
        }
        Path path = storageLayoutService.resolveClientPaymentReceipt(
                agenceId,
                payment.getBordereauCheminStockage()
        );
        if (!Files.isRegularFile(path)) {
            throw new ResourceNotFoundException("BordereauVersement", paymentId);
        }
        MediaType mediaType;
        try {
            mediaType = MediaType.parseMediaType(payment.getBordereauContentType());
        } catch (RuntimeException error) {
            mediaType = MediaType.APPLICATION_OCTET_STREAM;
        }
        return new DownloadedReceipt(
                new FileSystemResource(path),
                mediaType,
                payment.getBordereauNomFichier()
        );
    }

    private ReglementClientResponse savePayment(
            Long agenceId,
            Long userId,
            CreerReglementClientRequest request,
            MultipartFile receipt
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
        List<Long> directElementIds = requestedInstruments.stream()
                .flatMap(instrument -> instrument.getAffectations().stream())
                .filter(allocation -> allocation.getElementFacturableId() != null
                        && allocation.getDocumentClientId() == null)
                .map(CreerReglementClientRequest.Affectation::getElementFacturableId)
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
        if (!directElementIds.isEmpty()
                && !documentClientService.findIssuedInvoiceElementIds(directElementIds).isEmpty()) {
            throw new BadRequestException(
                    "Une ou plusieurs créances figurent désormais sur une facture émise"
            );
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
        boolean multiPayer = Boolean.TRUE.equals(request.getMultiPayeur());
        List<Payer> payers = resolvePayers(elements, documents, subscribers);
        Payer payer = resolvePaymentPayer(payers, multiPayer);
        if (multiPayer) {
            validateMultiPayerDeposit(request);
        } else {
            validateRequestedPayer(request, payer);
        }
        validateAllocations(requestedInstruments, elementsById, documentsById);

        Map<Long, AllocationAmounts> existingAmounts = loadAllocationAmounts(agenceId, elementIds);
        Map<Long, AllocationAmounts> existingDocumentAmounts =
                loadDocumentAllocationAmounts(agenceId, documentIds);
        Map<Long, BigDecimal> requestedByElement = requestedAmountsByElement(requestedInstruments);
        Map<Long, BigDecimal> requestedByDocument = requestedAmountsByDocument(requestedInstruments);
        Map<Long, Long> invoiceDocumentByElement = requestedInstruments.stream()
                .flatMap(instrument -> instrument.getAffectations().stream())
                .filter(allocation -> allocation.getElementFacturableId() != null
                        && allocation.getDocumentClientId() != null)
                .collect(Collectors.toMap(
                        CreerReglementClientRequest.Affectation::getElementFacturableId,
                        CreerReglementClientRequest.Affectation::getDocumentClientId,
                        (first, second) -> first
                ));
        Map<Long, Map<Long, AllocationAmounts>> invoiceLineAmounts = documentIds.stream()
                .collect(Collectors.toMap(
                        Function.identity(),
                        documentId -> invoiceLineAllocationAmounts(documentsById.get(documentId))
                ));
        requestedByElement.forEach((elementId, requestedAmount) -> {
            Long invoiceDocumentId = invoiceDocumentByElement.get(elementId);
            BigDecimal total = invoiceDocumentId == null
                    ? money(elementsById.get(elementId).getPrimeTotale())
                    : documentsById.get(invoiceDocumentId).getLignes().stream()
                            .filter(line -> line.getElementFacturable().getId().equals(elementId))
                            .map(LigneDocumentClient::getMontantTtc)
                            .map(this::money)
                            .findFirst()
                            .orElseThrow();
            AllocationAmounts current = invoiceDocumentId == null
                    ? existingAmounts.getOrDefault(elementId, AllocationAmounts.empty())
                    : invoiceLineAmounts.get(invoiceDocumentId)
                            .getOrDefault(elementId, AllocationAmounts.empty());
            BigDecimal available = total.subtract(current.confirmed()).subtract(current.pending()).subtract(current.adjustment());
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
            BigDecimal available = total.subtract(current.confirmed()).subtract(current.pending()).subtract(current.adjustment());
            if (requestedAmount.compareTo(available) > 0) {
                throw new BadRequestException(
                        "Le montant affecté dépasse le solde de la facture "
                                + documentsById.get(documentId).getNumero()
                );
            }
        });

        validateSettlementAdjustments(agenceId, request, elementsById, documentsById, existingAmounts,
                invoiceLineAmounts, requestedByElement, invoiceDocumentByElement);

        Agence agence = agenceRepository.findByIdForUpdate(agenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Agence", agenceId));
        Utilisateur user = utilisateurRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Utilisateur", userId));
        BigDecimal totalPayment = sumInstruments(requestedInstruments);
        BigDecimal totalAllocated = requestedInstruments.stream()
                .flatMap(instrument -> instrument.getAffectations().stream())
                .map(CreerReglementClientRequest.Affectation::getMontant)
                .map(this::money)
                .reduce(ZERO, BigDecimal::add);
        if (totalAllocated.compareTo(totalPayment) > 0) {
            throw new BadRequestException("Le montant affecté dépasse le total des moyens de règlement");
        }
        if (multiPayer && totalAllocated.compareTo(totalPayment) != 0) {
            throw new BadRequestException(
                    "Le montant du versement bancaire doit être entièrement affecté aux créances sélectionnées"
            );
        }
        BigDecimal unallocatedCredit = money(totalPayment.subtract(totalAllocated));
        BigDecimal maximumUnallocatedCredit = maxUnallocatedCredit(agenceId);
        if (unallocatedCredit.compareTo(maximumUnallocatedCredit) > 0) {
            throw new BadRequestException(
                    "Le montant restant à affecter de " + unallocatedCredit.toPlainString()
                            + " MAD dépasse le maximum autorisé de "
                            + maximumUnallocatedCredit.toPlainString() + " MAD"
            );
        }

        ReglementClient payment = ReglementClient.builder()
                .agence(agence)
                .numero(nextNumber(agence, request.getDateReglement().getYear()))
                .creePar(user)
                .build();
        payment.setDateReglement(request.getDateReglement());
        payment.setClientPayeur(payer.client());
        payment.setGroupePayeur(payer.group());
        payment.setPayeurNom(payer.name());
        payment.setMultiPayeur(multiPayer);
        payment.setDeposantNom(multiPayer ? trimToNull(request.getDeposantNom()) : null);
        payment.setStatut(StatutReglementClient.VALIDE);
        payment.setMontantTotal(totalPayment);
        payment.setMontantNonAffecte(unallocatedCredit);
        payment.setNotes(trimToNull(request.getNotes()));
        payment.setValidePar(user);
        payment.setDateValidation(LocalDateTime.now());

        for (CreerReglementClientRequest.Instrument requested : requestedInstruments) {
            InstrumentReglementClient instrument = buildInstrument(agence, payment, requested, true);
            payment.getInstruments().add(instrument);
            for (CreerReglementClientRequest.Affectation requestedAllocation : requested.getAffectations()) {
                Payer allocationPayer = resolveAllocationPayer(
                        requestedAllocation,
                        elementsById,
                        documentsById,
                        subscribers
                );
                AffectationReglementClient allocation = AffectationReglementClient.builder()
                        .instrument(instrument)
                        .elementFacturable(elementsById.get(requestedAllocation.getElementFacturableId()))
                        .documentClient(documentsById.get(requestedAllocation.getDocumentClientId()))
                        .montant(money(requestedAllocation.getMontant()))
                        .clientPayeur(allocationPayer.group() == null ? allocationPayer.client() : null)
                        .groupePayeur(allocationPayer.group())
                        .payeurNomSnapshot(allocationPayer.name())
                        .statut(StatutAffectationReglement.EN_ATTENTE)
                        .build();
                instrument.getAffectations().add(allocation);
            }
        }

        for (CreerReglementClientRequest.Ecart input : request.getEcarts() == null ? List.<CreerReglementClientRequest.Ecart>of() : request.getEcarts()) {
            EcartReglementClient ecart = new EcartReglementClient();
            ecart.setAgence(agence);
            ecart.setReglement(payment);
            ecart.setElementFacturable(elementsById.get(input.getElementFacturableId()));
            ecart.setDocumentClient(documentsById.get(input.getDocumentClientId()));
            ecart.setMontant(money(input.getMontant()));
            ecart.setMotif(input.getMotif().trim());
            payment.getEcarts().add(ecart);
        }
        payment = reglementRepository.saveAndFlush(payment);
        if (receipt != null) {
            storeReceipt(payment, receipt);
        }
        confirmImmediateInstruments(payment);
        reglementRepository.save(payment);
        recalculatePaymentFlags(agenceId, elementIds, documentIds);
        return toResponse(payment);
    }

    private void validateSettlementAdjustments(Long agenceId, CreerReglementClientRequest request,
            Map<Long, ElementFacturable> elements, Map<Long, DocumentClient> documents,
            Map<Long, AllocationAmounts> existing, Map<Long, Map<Long, AllocationAmounts>> invoiceAmounts,
            Map<Long, BigDecimal> requestedAmounts, Map<Long, Long> invoiceByElement) {
        if (request.getEcarts() == null || request.getEcarts().isEmpty()) return;
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getAuthorities().stream()
                .noneMatch(authority -> "PERM_reglement-client:manage".equals(authority.getAuthority()))) {
            throw new AccessDeniedException("La gestion des règlements est requise pour accorder un écart");
        }
        if (Boolean.TRUE.equals(request.getMultiPayeur())) {
            throw new BadRequestException("Accordez les écarts séparément pour chaque payeur");
        }
        Set<Long> seen = new HashSet<>();
        BigDecimal adjustmentTotal = ZERO;
        for (CreerReglementClientRequest.Ecart input : request.getEcarts()) {
            Long id = input.getElementFacturableId();
            Long invoiceId = invoiceByElement.get(id);
            if (id == null || !seen.add(id) || !elements.containsKey(id)
                    || !requestedAmounts.containsKey(id) || !Objects.equals(invoiceId, input.getDocumentClientId())) {
                throw new BadRequestException("L'écart doit concerner une créance effectivement réglée par ce paiement");
            }
            if (input.getMontant() == null || input.getMontant().signum() <= 0 || input.getMontant().scale() > 2
                    || input.getMotif() == null || input.getMotif().isBlank() || input.getMotif().length() > 500) {
                throw new BadRequestException("Renseignez un écart positif à deux décimales et son motif");
            }
            AllocationAmounts current = invoiceId == null ? existing.getOrDefault(id, AllocationAmounts.empty())
                    : invoiceAmounts.get(invoiceId).getOrDefault(id, AllocationAmounts.empty());
            BigDecimal total = invoiceId == null ? money(elements.get(id).getPrimeTotale())
                    : documents.get(invoiceId).getLignes().stream().filter(line -> line.getElementFacturable().getId().equals(id))
                    .map(LigneDocumentClient::getMontantTtc).map(this::money).findFirst().orElseThrow();
            BigDecimal remaining = total.subtract(current.confirmed()).subtract(current.pending())
                    .subtract(current.adjustment()).subtract(requestedAmounts.get(id));
            if (money(input.getMontant()).compareTo(remaining) > 0) {
                throw new BadRequestException("L'écart dépasse le solde restant de la créance");
            }
            adjustmentTotal = adjustmentTotal.add(money(input.getMontant()));
        }
        if (adjustmentTotal.compareTo(maxSettlementAdjustment(agenceId)) > 0) {
            throw new BadRequestException("L'écart total dépasse le plafond autorisé dans les paramètres comptables");
        }
    }

    private void confirmImmediateInstruments(ReglementClient payment) {
        LocalDate operationDate = LocalDate.now();
        for (InstrumentReglementClient instrument : payment.getInstruments()) {
            if (instrument.getMode() == ModeReglementClient.ESPECES
                    || instrument.getMode() == ModeReglementClient.VERSEMENT_BANCAIRE) {
                instrument.setStatut(StatutInstrumentReglement.CONFIRME);
                instrument.setDateStatut(operationDate);
                instrument.getAffectations().forEach(allocation ->
                        allocation.setStatut(StatutAffectationReglement.CONFIRMEE));
                tresorerieService.recordInstrumentEntry(
                        instrument,
                        instrument.getCompteTresorerie(),
                        payment.getDateReglement()
                );
            }
        }
    }

    @Transactional
    public ReglementClientResponse changeInstrumentStatus(
            Long agenceId,
            Long instrumentId,
            ChangerStatutInstrumentReglementRequest request
    ) {
        InstrumentReglementClient instrument = instrumentRepository.findByIdAndAgenceIdForUpdate(
                        instrumentId,
                        agenceId
                )
                .orElseThrow(() -> new ResourceNotFoundException("Instrument de règlement", instrumentId));
        boolean confirmation = request.getStatut() == StatutInstrumentReglement.CONFIRME;
        return instrumentActivity(instrument, confirmation ? ActivityAction.CONFIRMED : ActivityAction.REJECTED,
                confirmation ? "Moyen de paiement encaissé" : "Moyen de paiement rejeté",
                confirmation ? "PAYMENT_INSTRUMENT_CONFIRMATION" : "PAYMENT_INSTRUMENT_REJECTION",
                () -> changeInstrumentStatusRecord(agenceId, instrument, request));
    }

    private ReglementClientResponse changeInstrumentStatusRecord(Long agenceId, InstrumentReglementClient instrument,
            ChangerStatutInstrumentReglementRequest request) {
        if (instrument.getReglement().getStatut() != StatutReglementClient.VALIDE) {
            throw new BadRequestException("Le règlement doit être enregistré avant de traiter son moyen de paiement");
        }
        LocalDate operationDate = request.getDateOperation() == null ? LocalDate.now() : request.getDateOperation();
        if (request.getStatut() == StatutInstrumentReglement.CONFIRME) {
            confirmInstrument(agenceId, instrument, request.getCompteTresorerieId(), operationDate);
            updateRemittanceLine(
                    instrument,
                    StatutLigneBordereauRemise.ENCAISSEE,
                    operationDate,
                    null
            );
        } else if (request.getStatut() == StatutInstrumentReglement.REJETE) {
            rejectInstrument(instrument, request.getMotif(), operationDate);
            LigneBordereauRemise rejectionLine = updateRemittanceLine(
                    instrument,
                    StatutLigneBordereauRemise.REJETEE,
                    operationDate,
                    request.getMotif() == null ? null : request.getMotif().trim()
            );
            rejetSuiviService.enregistrerRejet(instrument, rejectionLine, operationDate, request.getMotif());
        } else {
            throw new BadRequestException("Cette transition de statut n'est pas autorisée");
        }
        instrument.setDateStatut(operationDate);
        instrument.setMotifStatut(trimToNull(request.getMotif()));
        instrumentRepository.save(instrument);
        refreshUnallocatedAmount(instrument.getReglement());
        recalculatePaymentFlags(agenceId, instrument.getAffectations().stream()
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
        Map<String, String> before = PaymentActivity.snapshot(payment);
        return businessActivityRecorder.perform(() -> cancelPaymentRecord(agenceId, payment, request), result ->
                PaymentActivity.command(payment, before, ActivityAction.CANCELLED,
                        "Règlement client annulé", "CLIENT_PAYMENT_CANCELLATION", null));
    }

    private ReglementClientResponse cancelPaymentRecord(Long agenceId, ReglementClient payment,
            AnnulerReglementClientRequest request) {
        if (payment.getInstruments().stream().anyMatch(instrument ->
                instrument.getStatut() == StatutInstrumentReglement.REMIS_EN_BANQUE)) {
            throw new BadRequestException(
                    "Un moyen de règlement est déjà remis en banque. Traitez d'abord son bordereau"
            );
        }
        payment.getInstruments().stream()
                .filter(instrument -> instrument.getStatut() == StatutInstrumentReglement.EN_ATTENTE)
                .forEach(this::ensureNotReservedByDraftRemittance);
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
                agenceId,
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
        InstrumentReglementClient replaced = instrumentRepository.findByIdAndAgenceIdForUpdate(
                        instrumentId,
                        agenceId
                )
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Instrument de règlement",
                        instrumentId
                ));
        Map<String, String> before = PaymentActivity.snapshot(replaced.getReglement());
        return businessActivityRecorder.perform(() -> replaceInstrumentRecord(agenceId, replaced, request), result ->
                PaymentActivity.command(replaced.getReglement(), before, ActivityAction.REPLACED,
                        "Moyen de paiement remplacé", "PAYMENT_INSTRUMENT_REPLACEMENT", PaymentActivity.reference(replaced)));
    }

    private ReglementClientResponse replaceInstrumentRecord(Long agenceId, InstrumentReglementClient replaced,
            RemplacerInstrumentReglementRequest request) {
        if (Boolean.TRUE.equals(replaced.getReglement().getMultiPayeur())) {
            throw new BadRequestException(
                    "Annulez puis ressaisissez le versement multi-clients avec son nouveau bordereau"
            );
        }
        if (replaced.getReglement().getStatut() != StatutReglementClient.VALIDE) {
            throw new BadRequestException("Le règlement doit être enregistré avant de remplacer son moyen de paiement");
        }
        boolean pendingReplacement = replaced.getStatut() == StatutInstrumentReglement.EN_ATTENTE;
        if (!pendingReplacement && replaced.getStatut() != StatutInstrumentReglement.REJETE) {
            throw new BadRequestException(
                    "Seul un instrument en attente ou rejeté peut être remplacé"
            );
        }
        if (pendingReplacement) {
            ensureNotReservedByDraftRemittance(replaced);
        }
        if (trimToNull(request.getMotif()) == null) {
            throw new BadRequestException("Le motif du remplacement est obligatoire");
        }
        List<RemplacerInstrumentReglementRequest.Instrument> requested = replacementInstruments(request);
        LocalDate replacementDate = request.getDateRemplacement() != null ? request.getDateRemplacement()
                : request.getDateInstrument() != null ? request.getDateInstrument() : LocalDate.now();
        if (replacementDate.isAfter(LocalDate.now())) {
            throw new BadRequestException("La date du remplacement ne peut pas être future");
        }
        if (!pendingReplacement && replaced.getDateStatut() != null && replacementDate.isBefore(replaced.getDateStatut())) {
            throw new BadRequestException("Le remplacement ne peut pas précéder le rejet bancaire");
        }
        BigDecimal requestedTotal = requested.stream()
                .map(row -> replacementAmount(row.getMontant()))
                .reduce(ZERO, BigDecimal::add);
        if (requestedTotal.compareTo(money(replaced.getMontant())) != 0) {
            throw new BadRequestException("Le total des nouveaux moyens doit être égal au montant de l'instrument d'origine");
        }
        List<AffectationReglementClient> sources = replacementAllocationSources(replaced, pendingReplacement);
        BigDecimal allocated = sources.stream().map(AffectationReglementClient::getMontant)
                .map(this::money).reduce(ZERO, BigDecimal::add);
        if (allocated.compareTo(requestedTotal) > 0) {
            throw new BadRequestException("Les affectations d'origine dépassent le montant à remplacer");
        }
        if (!pendingReplacement) {
            validateReplacementBalances(agenceId, sources);
        }

        List<InstrumentReglementClient> replacements = new ArrayList<>();
        Set<String> references = new HashSet<>();
        for (RemplacerInstrumentReglementRequest.Instrument row : requested) {
            if (row == null || row.getMode() == null) {
                throw new BadRequestException("Le mode de chaque nouveau moyen est obligatoire");
            }
            LocalDate receiptDate = row.getDateInstrument() == null ? replacementDate : row.getDateInstrument();
            if (receiptDate.isAfter(replacementDate)) {
                throw new BadRequestException("La réception d'un nouveau moyen ne peut pas suivre la date du remplacement");
            }
            String reference = trimToNull(row.getReferenceInstrument());
            if (reference != null && (row.getMode() == ModeReglementClient.CHEQUE
                    || row.getMode() == ModeReglementClient.EFFET
                    || row.getMode() == ModeReglementClient.VERSEMENT_BANCAIRE)) {
                String key = row.getMode() + ":" + (row.getMode() == ModeReglementClient.VERSEMENT_BANCAIRE
                        ? row.getCompteTresorerieId() : row.getBanqueEmettriceId())
                        + ":" + reference.toLowerCase(Locale.ROOT);
                if (!references.add(key)) {
                    throw new BadRequestException("Un même chèque, effet ou bordereau bancaire figure plusieurs fois dans le remplacement");
                }
            }
            CreerReglementClientRequest.Instrument entry = new CreerReglementClientRequest.Instrument();
            entry.setMode(row.getMode());
            entry.setMontant(replacementAmount(row.getMontant()));
            entry.setDateInstrument(receiptDate);
            entry.setDateEcheance(row.getDateEcheance());
            entry.setReferenceInstrument(reference);
            entry.setBanqueEmettriceId(row.getBanqueEmettriceId());
            entry.setCompteTresorerieId(row.getCompteTresorerieId());
            entry.setReglementBureau(false);
            InstrumentReglementClient replacement = buildInstrument(replaced.getAgence(), replaced.getReglement(), entry, false);
            replacement.setInstrumentRemplace(replaced);
            replacement.setDateStatut(replacementDate);
            if (replacement.getMode() == ModeReglementClient.VERSEMENT_BANCAIRE) {
                replacement.setStatut(StatutInstrumentReglement.CONFIRME);
            }
            replacements.add(replacement);
        }
        distributeReplacementAllocations(sources, replacements);

        replaced.getAffectations().forEach(allocation -> allocation.setStatut(StatutAffectationReglement.ANNULEE));
        replaced.setStatut(StatutInstrumentReglement.REMPLACE);
        replaced.setDateStatut(replacementDate);
        replaced.setMotifStatut(request.getMotif().trim());
        replaced.setSuiviRejet(StatutSuiviRejetBancaire.INSTANCE);
        replaced.getReglement().getInstruments().addAll(replacements);
        ReglementClient payment = reglementRepository.saveAndFlush(replaced.getReglement());
        for (InstrumentReglementClient replacement : replacements) {
            if (replacement.getStatut() == StatutInstrumentReglement.CONFIRME) {
                tresorerieService.recordInstrumentEntry(replacement, replacement.getCompteTresorerie(), replacementDate);
            }
        }
        rejetSuiviService.suivreOperation(replaced, TypeMouvementRejetBancaire.REMPLACEMENT, replacementDate, request.getMotif());
        refreshUnallocatedAmount(payment);
        recalculatePaymentFlags(
                agenceId,
                sources.stream().map(AffectationReglementClient::getElementFacturable)
                        .filter(Objects::nonNull).map(ElementFacturable::getId).distinct().toList(),
                sources.stream().map(AffectationReglementClient::getDocumentClient)
                        .filter(Objects::nonNull).map(DocumentClient::getId).distinct().toList()
        );
        return toResponse(payment);
    }

    private List<RemplacerInstrumentReglementRequest.Instrument> replacementInstruments(
            RemplacerInstrumentReglementRequest request
    ) {
        if (request.getInstruments() != null) {
            if (request.getInstruments().isEmpty() || request.getInstruments().size() > 50) {
                throw new BadRequestException("Le remplacement doit contenir entre 1 et 50 moyens de paiement");
            }
            if (request.getMode() != null || request.getMontant() != null || request.getDateInstrument() != null
                    || request.getDateEcheance() != null || request.getReferenceInstrument() != null
                    || request.getBanqueEmettriceId() != null || request.getCompteTresorerieId() != null) {
                throw new BadRequestException("Ne mélangez pas le format unitaire et les nouveaux moyens de remplacement");
            }
            if (request.getDateRemplacement() == null) {
                throw new BadRequestException("La date du remplacement est obligatoire");
            }
            if (request.getInstruments().stream().anyMatch(Objects::isNull)) {
                throw new BadRequestException("Un nouveau moyen de paiement est invalide");
            }
            return request.getInstruments();
        }
        var legacy = new RemplacerInstrumentReglementRequest.Instrument();
        legacy.setMode(request.getMode());
        legacy.setMontant(request.getMontant());
        legacy.setDateInstrument(request.getDateInstrument());
        legacy.setDateEcheance(request.getDateEcheance());
        legacy.setReferenceInstrument(request.getReferenceInstrument());
        legacy.setBanqueEmettriceId(request.getBanqueEmettriceId());
        legacy.setCompteTresorerieId(request.getCompteTresorerieId());
        return List.of(legacy);
    }

    private BigDecimal replacementAmount(BigDecimal amount) {
        if (amount == null || amount.signum() <= 0 || amount.precision() - amount.scale() > 14) {
            throw new BadRequestException("Chaque nouveau moyen doit avoir un montant strictement positif valide");
        }
        try {
            return amount.setScale(2, RoundingMode.UNNECESSARY);
        } catch (ArithmeticException exception) {
            throw new BadRequestException("Les montants de remplacement doivent avoir au maximum deux décimales");
        }
    }

    private List<AffectationReglementClient> replacementAllocationSources(
            InstrumentReglementClient replaced,
            boolean pending
    ) {
        return replaced.getAffectations().stream()
                .filter(source -> !pending || source.getStatut() != StatutAffectationReglement.ANNULEE)
                // Invoice issuance retains cancelled direct allocations alongside their new invoice allocation.
                .filter(source -> pending || source.getElementFacturable() == null
                        || replaced.getAffectations().stream().noneMatch(later -> later.getDocumentClient() != null
                                && later.getId() != null && source.getId() != null && later.getId() > source.getId()
                                && later.getDocumentClient().getLignes().stream().anyMatch(line ->
                                        line.getElementFacturable() != null && Objects.equals(
                                                line.getElementFacturable().getId(), source.getElementFacturable().getId()))))
                .sorted(Comparator.comparing(AffectationReglementClient::getId, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
    }

    private void distributeReplacementAllocations(
            List<AffectationReglementClient> sources,
            List<InstrumentReglementClient> replacements
    ) {
        int sourceIndex = 0;
        BigDecimal sourceRemaining = sources.isEmpty() ? ZERO : replacementAmount(sources.get(0).getMontant());
        // Fill each replacement in order, preserving every source target and any unallocated remainder.
        for (InstrumentReglementClient replacement : replacements) {
            BigDecimal capacity = money(replacement.getMontant());
            while (capacity.signum() > 0 && sourceIndex < sources.size()) {
                AffectationReglementClient source = sources.get(sourceIndex);
                BigDecimal slice = capacity.min(sourceRemaining);
                replacement.getAffectations().add(AffectationReglementClient.builder()
                        .instrument(replacement)
                        .elementFacturable(source.getElementFacturable())
                        .documentClient(source.getDocumentClient())
                        .clientPayeur(source.getClientPayeur())
                        .groupePayeur(source.getGroupePayeur())
                        .payeurNomSnapshot(source.getPayeurNomSnapshot())
                        .montant(slice)
                        .statut(replacement.getStatut() == StatutInstrumentReglement.CONFIRME
                                ? StatutAffectationReglement.CONFIRMEE : StatutAffectationReglement.EN_ATTENTE)
                        .build());
                capacity = capacity.subtract(slice);
                sourceRemaining = sourceRemaining.subtract(slice);
                if (sourceRemaining.signum() == 0) {
                    sourceIndex++;
                    sourceRemaining = sourceIndex < sources.size()
                            ? replacementAmount(sources.get(sourceIndex).getMontant()) : ZERO;
                }
            }
        }
        if (sourceIndex < sources.size()) {
            throw new BadRequestException("Les nouveaux moyens ne couvrent pas les affectations d'origine");
        }
    }

    @Transactional
    public ReglementClientResponse representInstrument(
            Long agenceId,
            Long instrumentId,
            RepresenterInstrumentReglementRequest request
    ) {
        InstrumentReglementClient instrument = instrumentRepository.findByIdAndAgenceIdForUpdate(
                        instrumentId,
                        agenceId
                )
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Instrument de règlement",
                        instrumentId
                ));
        return instrumentActivity(instrument, ActivityAction.SAVED,
                "Moyen de paiement préparé pour une nouvelle remise", "PAYMENT_INSTRUMENT_REPRESENTATION",
                () -> representInstrumentRecord(agenceId, instrument, request));
    }

    private ReglementClientResponse representInstrumentRecord(Long agenceId, InstrumentReglementClient instrument,
            RepresenterInstrumentReglementRequest request) {
        if (instrument.getReglement().getStatut() != StatutReglementClient.VALIDE) {
            throw new BadRequestException("Le règlement doit être enregistré avant la représentation");
        }
        if (instrument.getStatut() != StatutInstrumentReglement.REJETE) {
            throw new BadRequestException("Seul un instrument impayé peut être représenté");
        }
        if (instrument.getMode() != ModeReglementClient.CHEQUE
                && instrument.getMode() != ModeReglementClient.EFFET) {
            throw new BadRequestException("Seuls les chèques et effets peuvent être représentés");
        }
        if (request.getDateRepresentation().isAfter(LocalDate.now())) {
            throw new BadRequestException("La date de représentation ne peut pas être future");
        }
        if (instrument.getDateStatut() != null
                && request.getDateRepresentation().isBefore(instrument.getDateStatut())) {
            throw new BadRequestException("La représentation ne peut pas précéder le rejet bancaire");
        }
        validateReplacementBalances(agenceId, instrument.getAffectations());
        instrument.setStatut(StatutInstrumentReglement.EN_ATTENTE);
        instrument.setDateStatut(request.getDateRepresentation());
        instrument.setMotifStatut("Représentation : " + request.getMotif().trim());
        instrument.setSuiviRejet(StatutSuiviRejetBancaire.INSTANCE);
        instrument.setCompteTresorerie(null);
        instrument.setReglementBureau(false);
        instrument.getAffectations().forEach(allocation ->
                allocation.setStatut(StatutAffectationReglement.EN_ATTENTE));
        ReglementClient payment = reglementRepository.saveAndFlush(instrument.getReglement());
        rejetSuiviService.suivreOperation(instrument, TypeMouvementRejetBancaire.PREPARATION_REMISE,
                request.getDateRepresentation(), request.getMotif());
        refreshUnallocatedAmount(payment);
        recalculatePaymentFlags(
                agenceId,
                instrument.getAffectations().stream()
                        .map(AffectationReglementClient::getElementFacturable)
                        .filter(Objects::nonNull)
                        .map(ElementFacturable::getId)
                        .distinct()
                        .toList(),
                instrument.getAffectations().stream()
                        .map(AffectationReglementClient::getDocumentClient)
                        .filter(Objects::nonNull)
                        .map(DocumentClient::getId)
                        .distinct()
                        .toList()
        );
        return toResponse(payment);
    }

    @Transactional(readOnly = true)
    public List<ReglementClientResponse.Instrument> pendingInstruments(Long agenceId) {
        List<InstrumentReglementClient> instruments = instrumentRepository
                .findByAgenceIdAndStatutInOrderByDateEcheanceAscIdAsc(
                        agenceId,
                        Set.of(
                                StatutInstrumentReglement.EN_ATTENTE,
                                StatutInstrumentReglement.REMIS_EN_BANQUE
                        )
                ).stream()
                .filter(instrument -> instrument.getReglement().getStatut()
                        == StatutReglementClient.VALIDE)
                .filter(instrument -> instrument.getStatut()
                        == StatutInstrumentReglement.REMIS_EN_BANQUE
                        || (instrument.getMode() != ModeReglementClient.CHEQUE
                            && instrument.getMode() != ModeReglementClient.EFFET))
                .toList();
        Map<Long, LigneBordereauRemise> remittanceLines = activeRemittanceLines(
                instruments.stream().map(InstrumentReglementClient::getId).toList()
        );
        Map<Long, String> assistanceNumbers = assistanceNumbers(agenceId, instruments);
        return instruments.stream()
                .map(instrument -> toInstrumentResponse(
                        instrument,
                        remittanceLines.get(instrument.getId()), assistanceNumbers
                ))
                .toList();
    }

    @Transactional(readOnly = true)
    public InstrumentReglementPageResponse searchInstruments(
            Long agenceId,
            Collection<StatutInstrumentReglement> statuses,
            Collection<ModeReglementClient> modes,
            LocalDate dateDu,
            LocalDate dateAu,
            String payeurType,
            Long payeurId,
            String search,
            String sortBy,
            String sortDirection,
            int page,
            int size
    ) {
        validateOptionalPayer(payeurType, payeurId);
        if (dateDu != null && dateAu != null && dateDu.isAfter(dateAu)) {
            throw new BadRequestException("La date de début doit précéder la date de fin");
        }
        Page<InstrumentReglementClient> result = instrumentRepository.searchByStatus(
                agenceId,
                statuses,
                modes,
                dateDu,
                dateAu,
                payeurType,
                payeurId,
                search == null || search.isBlank() ? null : search.trim(),
                instrumentSortBy(sortBy),
                "DESC".equalsIgnoreCase(sortDirection) ? "DESC" : "ASC",
                PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100))
        );
        Map<Long, LigneBordereauRemise> remittanceLines = activeRemittanceLines(
                result.getContent().stream().map(InstrumentReglementClient::getId).toList()
        );
        if (!result.getContent().isEmpty()
                && statuses.contains(StatutInstrumentReglement.REJETE)) {
            remittanceLineRepository.findHistoryByInstrumentIds(
                            result.getContent().stream().map(InstrumentReglementClient::getId).toList()
                    ).forEach(line -> remittanceLines.putIfAbsent(
                            line.getInstrument().getId(),
                            line
                    ));
        }
        return InstrumentReglementPageResponse.builder()
                .page(SourceDocumentClientPageResponse.PageInfo.builder()
                        .number(result.getNumber())
                        .size(result.getSize())
                        .totalElements(result.getTotalElements())
                        .totalPages(result.getTotalPages())
                        .first(result.isFirst())
                        .last(result.isLast())
                        .build())
                .rows(result.getContent().stream()
                        .map(instrument -> toInstrumentRegisterResponse(
                                instrument,
                                remittanceLines.get(instrument.getId())
                        ))
                        .toList())
                .build();
    }

    @Transactional(readOnly = true)
    public InstrumentReglementPageResponse searchBankRejections(
            Long agenceId,
            ModeReglementClient mode,
            Long bankId,
            LocalDate dateDu,
            LocalDate dateAu,
            String payeurType,
            Long payeurId,
            ResolutionRejetBancaire resolution,
            String search,
            String sortBy,
            String sortDirection,
            int page,
            int size
    ) {
        validateOptionalPayer(payeurType, payeurId);
        if (mode != null && mode != ModeReglementClient.CHEQUE && mode != ModeReglementClient.EFFET) {
            throw new BadRequestException("Seuls les chèques et effets sont concernés par les rejets bancaires");
        }
        if (dateDu != null && dateAu != null && dateDu.isAfter(dateAu)) {
            throw new BadRequestException("La date de début doit précéder la date de fin");
        }
        Page<InstrumentReglementClient> result = instrumentRepository.searchBankRejections(
                agenceId, mode, bankId, dateDu, dateAu, payeurType, payeurId, resolution == null ? null : resolution.name(),
                trimToNull(search),
                bankRejectionSortBy(sortBy), "ASC".equalsIgnoreCase(sortDirection) ? "ASC" : "DESC",
                PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100))
        );
        Map<Long, LigneBordereauRemise> rejections = new LinkedHashMap<>();
        if (!result.isEmpty()) {
            remittanceLineRepository.findRejectionsByAgenceIdAndInstrumentIds(
                    agenceId, result.getContent().stream().map(InstrumentReglementClient::getId).toList()
            ).forEach(line -> rejections.putIfAbsent(line.getInstrument().getId(), line));
        }
        return InstrumentReglementPageResponse.builder()
                .page(SourceDocumentClientPageResponse.PageInfo.builder()
                        .number(result.getNumber()).size(result.getSize())
                        .totalElements(result.getTotalElements()).totalPages(result.getTotalPages())
                        .first(result.isFirst()).last(result.isLast()).build())
                .rows(result.getContent().stream()
                        .map(instrument -> toInstrumentRegisterResponse(instrument, rejections.get(instrument.getId())))
                        .toList())
                .build();
    }

    @Transactional
    public ReglementClientResponse registerBankRejection(
            Long agenceId,
            Long instrumentId,
            ChangerStatutInstrumentReglementRequest request
    ) {
        InstrumentReglementClient instrument = instrumentRepository.findByIdAndAgenceIdForUpdate(instrumentId, agenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Instrument de règlement", instrumentId));
        if (!bankRejectionPossible(instrument)) {
            throw new BadRequestException("Seul un chèque ou effet remis en banque ou encaissé peut être rejeté");
        }
        LocalDate date = request.getDateOperation();
        if (date == null || date.isAfter(LocalDate.now())
                || (instrument.getDateStatut() != null && date.isBefore(instrument.getDateStatut()))) {
            throw new BadRequestException("La date du rejet doit être comprise entre la remise ou l'encaissement et aujourd'hui");
        }
        request.setStatut(StatutInstrumentReglement.REJETE);
        return changeInstrumentStatus(agenceId, instrumentId, request);
    }

    private boolean bankRejectionPossible(InstrumentReglementClient instrument) {
        return instrument.getReglement().getStatut() == StatutReglementClient.VALIDE
                && (instrument.getMode() == ModeReglementClient.CHEQUE || instrument.getMode() == ModeReglementClient.EFFET)
                && (instrument.getStatut() == StatutInstrumentReglement.REMIS_EN_BANQUE
                || instrument.getStatut() == StatutInstrumentReglement.CONFIRME);
    }

    private String bankRejectionSortBy(String sortBy) {
        String key = sortBy == null ? "" : sortBy.trim().toUpperCase(Locale.ROOT);
        return switch (key) {
            case "MODE", "REFERENCE", "PAYER", "AMOUNT", "PAYMENT_DATE", "RETURN_DATE" -> key;
            default -> "RETURN_DATE";
        };
    }

    private String instrumentSortBy(String sortBy) {
        return switch (sortBy == null ? "" : sortBy.trim().toUpperCase(Locale.ROOT)) {
            case "REFERENCE", "PAYER", "PAYMENT", "MODE", "RECEIVED", "STATUS_DATE", "AMOUNT" ->
                    sortBy.trim().toUpperCase(Locale.ROOT);
            default -> "DUE";
        };
    }

    public ReglementClientResponse.Instrument toInstrumentRegisterResponse(
            InstrumentReglementClient instrument
    ) {
        return toInstrumentRegisterResponse(instrument, null);
    }

    private ReglementClientResponse.Instrument toInstrumentRegisterResponse(
            InstrumentReglementClient instrument,
            LigneBordereauRemise remittanceLine
    ) {
        boolean rejected = instrument.getStatut() == StatutInstrumentReglement.REJETE;
        boolean rejectedLine = remittanceLine != null && remittanceLine.getStatut() == StatutLigneBordereauRemise.REJETEE;
        boolean hasRejection = instrument.getDateRejet() != null || rejected || rejectedLine;
        boolean canResolve = rejected && instrument.getReglement().getStatut() == StatutReglementClient.VALIDE
                && (instrument.getMode() == ModeReglementClient.CHEQUE || instrument.getMode() == ModeReglementClient.EFFET);
        boolean canReplacePending = instrument.getStatut() == StatutInstrumentReglement.EN_ATTENTE
                && instrument.getReglement().getStatut() == StatutReglementClient.VALIDE
                && (instrument.getMode() == ModeReglementClient.CHEQUE || instrument.getMode() == ModeReglementClient.EFFET)
                && (remittanceLine == null || remittanceLine.getStatut() == StatutLigneBordereauRemise.REJETEE);
        return ReglementClientResponse.Instrument.builder()
                .id(instrument.getId())
                .reglementId(instrument.getReglement().getId())
                .clientPayeurId(instrument.getReglement().getClientPayeur() == null
                        ? null : instrument.getReglement().getClientPayeur().getId())
                .numeroReglement(instrument.getReglement().getNumero())
                .statutReglement(instrument.getReglement().getStatut())
                .payeurNom(instrument.getReglement().getPayeurNom())
                .mode(instrument.getMode())
                .statut(instrument.getStatut())
                .montant(instrument.getMontant())
                .dateInstrument(instrument.getDateInstrument())
                .dateReglement(instrument.getReglement().getDateReglement())
                .statutSuiviRejet(hasRejection ? rejetSuiviService.statut(instrument) : null)
                .dateEcheance(instrument.getDateEcheance())
                .dateStatut(instrument.getDateStatut())
                .referenceInstrument(instrument.getReferenceInstrument())
                .banqueEmettriceId(instrument.getBanqueEmettriceReference() == null
                        ? null : instrument.getBanqueEmettriceReference().getId())
                .banqueEmettriceCode(instrument.getBanqueEmettriceReference() == null
                        ? null : instrument.getBanqueEmettriceReference().getCode())
                .banqueEmettrice(instrument.getBanqueEmettriceReference() == null
                        ? null : instrument.getBanqueEmettriceReference().getLibelle())
                .reglementBureau(instrument.getReglementBureau())
                .motifStatut(instrument.getMotifStatut())
                .dateRejet(instrument.getDateRejet() != null ? instrument.getDateRejet()
                        : rejectedLine ? remittanceLine.getDateTraitement() : rejected ? instrument.getDateStatut() : null)
                .motifRejet(instrument.getDateRejet() != null ? instrument.getMotifRejet()
                        : rejectedLine ? remittanceLine.getMotifRejet() : rejected ? instrument.getMotifStatut() : null)
                .resolutionRejet(hasRejection
                        ? rejected ? ResolutionRejetBancaire.A_TRAITER
                                : instrument.getStatut() == StatutInstrumentReglement.REMPLACE
                                        ? ResolutionRejetBancaire.REMPLACE : ResolutionRejetBancaire.REPRESENTE
                        : null)
                .rejetBancairePossible(bankRejectionPossible(instrument))
                .representationPossible(canResolve)
                .remplacementPossible((canResolve || canReplacePending)
                        && !Boolean.TRUE.equals(instrument.getReglement().getMultiPayeur()))
                .instrumentRemplaceId(instrument.getInstrumentRemplace() == null
                        ? null : instrument.getInstrumentRemplace().getId())
                .modeInstrumentRemplace(instrument.getInstrumentRemplace() == null
                        ? null : instrument.getInstrumentRemplace().getMode())
                .referenceInstrumentRemplace(instrument.getInstrumentRemplace() == null
                        ? null : instrument.getInstrumentRemplace().getReferenceInstrument())
                .compteTresorerieId(instrument.getCompteTresorerie() == null
                        ? null : instrument.getCompteTresorerie().getId())
                .compteTresorerie(instrument.getCompteTresorerie() == null
                        ? null : instrument.getCompteTresorerie().getLibelle())
                .bordereauRemiseId(remittanceLine == null
                        ? null : remittanceLine.getBordereau().getId())
                .numeroBordereauRemise(remittanceLine == null
                        ? null : remittanceLine.getBordereau().getNumero())
                .statutBordereauRemise(remittanceLine == null
                        ? null : remittanceLine.getBordereau().getStatut())
                .affectations(List.of())
                .build();
    }

    private Map<Long, LigneBordereauRemise> activeRemittanceLines(List<Long> instrumentIds) {
        if (instrumentIds.isEmpty()) {
            return new LinkedHashMap<>();
        }
        return remittanceLineRepository.findActiveByInstrumentIds(
                        instrumentIds,
                        Set.of(
                                StatutBordereauRemise.BROUILLON,
                                StatutBordereauRemise.DEPOSE,
                                StatutBordereauRemise.PARTIELLEMENT_TRAITE
                        )
                ).stream()
                .collect(Collectors.toMap(
                        line -> line.getInstrument().getId(),
                        Function.identity(),
                        (first, ignored) -> first,
                        LinkedHashMap::new
                ));
    }

    private InstrumentReglementClient buildInstrument(
            Agence agence,
            ReglementClient payment,
            CreerReglementClientRequest.Instrument request,
            boolean deferCashConfirmation
    ) {
        BigDecimal allocated = request.getAffectations().stream()
                .map(CreerReglementClientRequest.Affectation::getMontant)
                .map(this::money)
                .reduce(ZERO, BigDecimal::add);
        if (allocated.compareTo(money(request.getMontant())) > 0) {
            throw new BadRequestException("Une ventilation dépasse le montant de son moyen de règlement");
        }
        boolean cash = request.getMode() == ModeReglementClient.ESPECES;
        CompteTresorerie account = cash
                ? tresorerieService.findCurrentUserCashAccount(agence.getId())
                : null;
        if (!cash && request.getCompteTresorerieId() != null) {
            account = tresorerieService.findAccount(agence.getId(), request.getCompteTresorerieId());
            if (!Boolean.TRUE.equals(account.getActif())) {
                throw new BadRequestException("Le compte de trésorerie sélectionné est inactif");
            }
        }
        if (!cash && account != null && account.getTypeCompte() != TypeCompteTresorerie.BANQUE) {
            throw new BadRequestException("Ce moyen de règlement doit être rattaché à un compte bancaire");
        }
        if (BANK_ACCOUNT_REQUIRED_MODES.contains(request.getMode()) && account == null) {
            throw new BadRequestException("Sélectionnez le compte bancaire crédité");
        }
        validateInstrumentReference(request);
        if (request.getMode() == ModeReglementClient.VERSEMENT_BANCAIRE
                && instrumentRepository.existsDirectDepositReference(
                        agence.getId(),
                        account.getId(),
                        request.getReferenceInstrument().trim(),
                        payment.getId()
                )) {
            throw new BadRequestException(
                    "Ce numéro de bordereau bancaire est déjà enregistré sur le compte sélectionné"
            );
        }
        Banque originatingBank = resolveOriginatingBank(agence.getId(), request);
        if (Boolean.TRUE.equals(request.getReglementBureau())
                && request.getMode() != ModeReglementClient.CHEQUE
                && request.getMode() != ModeReglementClient.EFFET) {
            throw new BadRequestException(
                    "Le règlement au bureau est réservé aux chèques et effets"
            );
        }
        return InstrumentReglementClient.builder()
                .agence(agence)
                .reglement(payment)
                .mode(request.getMode())
                .statut(cash && !deferCashConfirmation
                        ? StatutInstrumentReglement.CONFIRME
                        : StatutInstrumentReglement.EN_ATTENTE)
                .montant(money(request.getMontant()))
                .dateInstrument(request.getDateInstrument() == null
                        ? payment.getDateReglement() : request.getDateInstrument())
                .dateEcheance(request.getDateEcheance())
                .referenceInstrument(trimToNull(request.getReferenceInstrument()))
                .banqueEmettriceReference(originatingBank)
                .reglementBureau(Boolean.TRUE.equals(request.getReglementBureau()))
                .compteTresorerie(account)
                .dateStatut(payment.getDateReglement())
                .build();
    }

    private void validateReplacementBalances(Long agenceId, List<AffectationReglementClient> allocations) {
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
        Map<Long, AllocationAmounts> elementAmounts = loadAllocationAmounts(agenceId, elementIds);
        Map<Long, AllocationAmounts> documentAmounts = loadDocumentAllocationAmounts(agenceId, documentIds);
        for (AffectationReglementClient allocation : allocations) {
            if (allocation.getElementFacturable() != null) {
                ElementFacturable element = allocation.getElementFacturable();
                AllocationAmounts current = elementAmounts.getOrDefault(
                        element.getId(),
                        AllocationAmounts.empty()
                );
                BigDecimal available = money(element.getPrimeTotale())
                        .subtract(current.confirmed())
                        .subtract(current.pending()).subtract(current.adjustment());
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
                        .subtract(current.pending()).subtract(current.adjustment());
                if (money(allocation.getMontant()).compareTo(available) > 0) {
                    throw new BadRequestException(
                            "La facture a été réglée depuis le rejet de l'instrument"
                    );
                }
            }
        }
    }

    @Transactional
    public MouvementTresorerie confirmInstrumentFromBankStatement(
            Long agenceId,
            Long instrumentId,
            Long accountId,
            LocalDate operationDate,
            LigneReleveBancaire bankStatementLine
    ) {
        InstrumentReglementClient instrument = instrumentRepository.findByIdAndAgenceIdForUpdate(
                        instrumentId,
                        agenceId
                )
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Instrument de règlement",
                        instrumentId
                ));
        return instrumentActivity(instrument, ActivityAction.CONFIRMED,
                "Moyen de paiement encaissé par rapprochement bancaire", "PAYMENT_CONFIRMATION_FROM_BANK_STATEMENT",
                () -> confirmFromBankStatementRecord(agenceId, instrument, accountId, operationDate, bankStatementLine));
    }

    private MouvementTresorerie confirmFromBankStatementRecord(Long agenceId, InstrumentReglementClient instrument,
            Long accountId, LocalDate operationDate, LigneReleveBancaire bankStatementLine) {
        MouvementTresorerie movement = confirmInstrument(
                agenceId,
                instrument,
                accountId,
                operationDate,
                bankStatementLine
        );
        instrument.setDateStatut(operationDate);
        instrument.setMotifStatut("Confirmé par rapprochement bancaire");
        instrumentRepository.save(instrument);
        updateRemittanceLine(
                instrument,
                StatutLigneBordereauRemise.ENCAISSEE,
                operationDate,
                null
        );
        refreshUnallocatedAmount(instrument.getReglement());
        recalculatePaymentFlags(
                agenceId,
                instrument.getAffectations().stream()
                        .map(AffectationReglementClient::getElementFacturable)
                        .filter(Objects::nonNull)
                        .map(ElementFacturable::getId)
                        .distinct()
                        .toList(),
                instrument.getAffectations().stream()
                        .map(AffectationReglementClient::getDocumentClient)
                        .filter(Objects::nonNull)
                        .map(DocumentClient::getId)
                        .distinct()
                        .toList()
        );
        return movement;
    }

    private MouvementTresorerie confirmInstrument(
            Long agenceId,
            InstrumentReglementClient instrument,
            Long accountId,
            LocalDate operationDate
    ) {
        return confirmInstrument(agenceId, instrument, accountId, operationDate, null);
    }

    private MouvementTresorerie confirmInstrument(
            Long agenceId,
            InstrumentReglementClient instrument,
            Long accountId,
            LocalDate operationDate,
            LigneReleveBancaire bankStatementLine
    ) {
        if (instrument.getReglement().getStatut() != StatutReglementClient.VALIDE) {
            throw new BadRequestException("Le règlement doit être enregistré avant l'encaissement");
        }
        if (instrument.getStatut() != StatutInstrumentReglement.EN_ATTENTE
                && instrument.getStatut() != StatutInstrumentReglement.REMIS_EN_BANQUE) {
            throw new BadRequestException("Seul un instrument en attente ou remis peut être confirmé");
        }
        if (instrument.getStatut() == StatutInstrumentReglement.EN_ATTENTE) {
            ensureNotReservedByDraftRemittance(instrument);
            if (instrument.getMode() == ModeReglementClient.CHEQUE
                    || instrument.getMode() == ModeReglementClient.EFFET) {
                throw new BadRequestException(
                        "Déposez d'abord le chèque ou l'effet dans un bordereau de remise"
                );
            }
        }
        if (accountId == null && instrument.getCompteTresorerie() == null) {
            throw new BadRequestException("Sélectionnez le compte bancaire ou la caisse créditée");
        }
        CompteTresorerie account = accountId == null
                ? instrument.getCompteTresorerie()
                : tresorerieService.findAccount(agenceId, accountId);
        if (instrument.getStatut() == StatutInstrumentReglement.REMIS_EN_BANQUE
                && instrument.getCompteTresorerie() != null
                && !instrument.getCompteTresorerie().getId().equals(account.getId())) {
            throw new BadRequestException(
                    "L'instrument doit être encaissé sur le compte du bordereau de remise"
            );
        }
        TypeCompteTresorerie expectedType = instrument.getMode() == ModeReglementClient.ESPECES
                ? TypeCompteTresorerie.CAISSE : TypeCompteTresorerie.BANQUE;
        if (account.getTypeCompte() != expectedType || !Boolean.TRUE.equals(account.getActif())) {
            throw new BadRequestException("Le type de compte ne correspond pas au moyen de règlement");
        }
        if (instrument.getMode() == ModeReglementClient.ESPECES
                && account.getNatureCaisse() != NatureCaisseTresorerie.INDIVIDUELLE) {
            throw new BadRequestException("Un règlement en espèces doit utiliser une caisse individuelle");
        }
        instrument.setCompteTresorerie(account);
        instrument.setStatut(StatutInstrumentReglement.CONFIRME);
        instrument.getAffectations().forEach(allocation ->
                allocation.setStatut(StatutAffectationReglement.CONFIRMEE));
        instrumentRepository.saveAndFlush(instrument);
        rejetSuiviService.suivreOperation(instrument, TypeMouvementRejetBancaire.ENCAISSEMENT, operationDate,
                "Encaissement confirmé");
        return tresorerieService.recordInstrumentEntry(
                instrument,
                account,
                operationDate,
                bankStatementLine
        );
    }

    private void rejectInstrument(
            InstrumentReglementClient instrument,
            String reason,
            LocalDate operationDate
    ) {
        if (instrument.getReglement().getStatut() != StatutReglementClient.VALIDE) {
            throw new BadRequestException("Le règlement doit être enregistré avant le rejet de son moyen");
        }
        if (instrument.getStatut() != StatutInstrumentReglement.EN_ATTENTE
                && instrument.getStatut() != StatutInstrumentReglement.REMIS_EN_BANQUE
                && instrument.getStatut() != StatutInstrumentReglement.CONFIRME) {
            throw new BadRequestException("Cet instrument ne peut pas être rejeté");
        }
        if (reason == null || reason.isBlank()) {
            throw new BadRequestException("Le motif du rejet est obligatoire");
        }
        if (instrument.getStatut() == StatutInstrumentReglement.EN_ATTENTE) {
            ensureNotReservedByDraftRemittance(instrument);
        }
        if (instrument.getStatut() == StatutInstrumentReglement.CONFIRME) {
            tresorerieService.reverseInstrumentEntry(instrument, reason.trim(), operationDate);
        }
        instrument.setStatut(StatutInstrumentReglement.REJETE);
        instrument.setDateRejet(operationDate);
        instrument.setMotifRejet(reason.trim());
        instrument.setSuiviRejet(StatutSuiviRejetBancaire.INSTANCE);
        instrument.getAffectations().forEach(allocation ->
                allocation.setStatut(StatutAffectationReglement.ANNULEE));
    }

    @Transactional
    public void markInstrumentRemitted(
            Long agenceId,
            Long instrumentId,
            Long accountId,
            LocalDate operationDate
    ) {
        InstrumentReglementClient instrument = instrumentRepository.findByIdAndAgenceIdForUpdate(
                        instrumentId,
                        agenceId
                )
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Instrument de règlement",
                        instrumentId
                ));
        instrumentActivity(instrument, ActivityAction.REMITTED, "Moyen de paiement remis en banque", "PAYMENT_BANK_REMITTANCE", () -> {
            markInstrumentRemittedRecord(agenceId, instrument, accountId, operationDate);
            return instrument;
        });
    }

    private void markInstrumentRemittedRecord(Long agenceId, InstrumentReglementClient instrument,
            Long accountId, LocalDate operationDate) {
        if (instrument.getStatut() != StatutInstrumentReglement.EN_ATTENTE) {
            throw new BadRequestException("Seul un instrument en attente peut être remis en banque");
        }
        if (instrument.getReglement().getStatut() != StatutReglementClient.VALIDE) {
            throw new BadRequestException("Le règlement doit être enregistré avant la remise en banque");
        }
        if (instrument.getMode() != ModeReglementClient.CHEQUE
                && instrument.getMode() != ModeReglementClient.EFFET) {
            throw new BadRequestException("Seuls les chèques et effets utilisent un bordereau de remise");
        }
        CompteTresorerie account = tresorerieService.findAccount(agenceId, accountId);
        if (account.getTypeCompte() != TypeCompteTresorerie.BANQUE
                || !Boolean.TRUE.equals(account.getActif())) {
            throw new BadRequestException("Le compte bancaire de destination est invalide ou inactif");
        }
        instrument.setCompteTresorerie(account);
        instrument.setStatut(StatutInstrumentReglement.REMIS_EN_BANQUE);
        instrument.setDateStatut(operationDate);
        instrument.setMotifStatut("Remis en banque");
        instrumentRepository.save(instrument);
        rejetSuiviService.suivreOperation(instrument, TypeMouvementRejetBancaire.REMISE_EN_BANQUE, operationDate,
                "Remise en banque");
    }

    @Transactional
    public MouvementTresorerie confirmInstrumentFromRemittance(
            Long agenceId,
            Long instrumentId,
            Long accountId,
            LocalDate operationDate
    ) {
        InstrumentReglementClient instrument = instrumentRepository.findByIdAndAgenceIdForUpdate(
                        instrumentId,
                        agenceId
                )
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Instrument de règlement",
                        instrumentId
                ));
        return instrumentActivity(instrument, ActivityAction.CONFIRMED,
                "Moyen de paiement encaissé depuis un bordereau", "PAYMENT_CONFIRMATION_FROM_REMITTANCE",
                () -> confirmFromRemittanceRecord(agenceId, instrument, accountId, operationDate));
    }

    private MouvementTresorerie confirmFromRemittanceRecord(Long agenceId, InstrumentReglementClient instrument,
            Long accountId, LocalDate operationDate) {
        if (instrument.getStatut() != StatutInstrumentReglement.REMIS_EN_BANQUE) {
            throw new BadRequestException("L'instrument doit être remis en banque avant encaissement");
        }
        MouvementTresorerie movement = confirmInstrument(
                agenceId,
                instrument,
                accountId,
                operationDate
        );
        instrument.setDateStatut(operationDate);
        instrument.setMotifStatut("Encaissé depuis le bordereau de remise");
        instrumentRepository.save(instrument);
        updateRemittanceLine(
                instrument,
                StatutLigneBordereauRemise.ENCAISSEE,
                operationDate,
                null
        );
        refreshAfterInstrumentTransition(instrument);
        return movement;
    }

    @Transactional
    public void rejectInstrumentFromRemittance(
            Long agenceId,
            Long instrumentId,
            String reason,
            LocalDate operationDate
    ) {
        InstrumentReglementClient instrument = instrumentRepository.findByIdAndAgenceIdForUpdate(
                        instrumentId,
                        agenceId
                )
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Instrument de règlement",
                        instrumentId
                ));
        instrumentActivity(instrument, ActivityAction.REJECTED, "Moyen de paiement rejeté depuis un bordereau",
                "PAYMENT_REJECTION_FROM_REMITTANCE", () -> {
                    rejectFromRemittanceRecord(instrument, reason, operationDate);
                    return instrument;
                });
    }

    private void rejectFromRemittanceRecord(InstrumentReglementClient instrument, String reason, LocalDate operationDate) {
        if (instrument.getStatut() != StatutInstrumentReglement.REMIS_EN_BANQUE
                && instrument.getStatut() != StatutInstrumentReglement.CONFIRME) {
            throw new BadRequestException("L'instrument n'est pas remis ou encaissé");
        }
        rejectInstrument(instrument, reason, operationDate);
        instrument.setDateStatut(operationDate);
        instrument.setMotifStatut(reason.trim());
        instrumentRepository.save(instrument);
        LigneBordereauRemise rejectionLine = updateRemittanceLine(
                instrument,
                StatutLigneBordereauRemise.REJETEE,
                operationDate,
                reason.trim()
        );
        rejetSuiviService.enregistrerRejet(instrument, rejectionLine, operationDate, reason);
        refreshAfterInstrumentTransition(instrument);
    }

    private <T> T instrumentActivity(InstrumentReglementClient instrument, ActivityAction action, String title,
            String origin, Supplier<T> work) {
        Map<String, String> before = PaymentActivity.instrumentSnapshot(instrument);
        return businessActivityRecorder.perform(work, result ->
                PaymentActivity.instrumentCommand(instrument, before, action, title, origin));
    }

    private LigneBordereauRemise updateRemittanceLine(
            InstrumentReglementClient instrument,
            StatutLigneBordereauRemise status,
            LocalDate operationDate,
            String reason
    ) {
        List<LigneBordereauRemise> activeLines = remittanceLineRepository.findActiveByInstrumentId(
                instrument.getId(),
                Set.of(
                        StatutBordereauRemise.DEPOSE,
                        StatutBordereauRemise.PARTIELLEMENT_TRAITE
                )
        );
        if (activeLines.size() > 1) {
            throw new BadRequestException("L'instrument appartient à plusieurs bordereaux actifs");
        }
        List<LigneBordereauRemise> candidateLines = activeLines.isEmpty()
                ? remittanceLineRepository.findHistoryByInstrumentId(instrument.getId())
                : activeLines;
        if (candidateLines.isEmpty()) {
            return null;
        }
        LigneBordereauRemise line = candidateLines.get(0);
        if (status == StatutLigneBordereauRemise.REJETEE && line.getStatut() == StatutLigneBordereauRemise.REJETEE) {
            return null;
        }
        line.setStatut(status);
        line.setDateTraitement(operationDate);
        line.setMotifRejet(reason);
        remittanceLineRepository.save(line);
        return line;
    }

    private void ensureNotReservedByDraftRemittance(InstrumentReglementClient instrument) {
        if (!remittanceLineRepository.findActiveByInstrumentId(
                instrument.getId(),
                Set.of(StatutBordereauRemise.BROUILLON)
        ).isEmpty()) {
            throw new BadRequestException(
                    "L'instrument appartient à un bordereau provisoire. Remettez ou supprimez ce bordereau"
            );
        }
    }

    private void refreshAfterInstrumentTransition(InstrumentReglementClient instrument) {
        refreshUnallocatedAmount(instrument.getReglement());
        recalculatePaymentFlags(
                instrument.getReglement().getAgence().getId(),
                instrument.getAffectations().stream()
                        .map(AffectationReglementClient::getElementFacturable)
                        .filter(Objects::nonNull)
                        .map(ElementFacturable::getId)
                        .distinct()
                        .toList(),
                instrument.getAffectations().stream()
                        .map(AffectationReglementClient::getDocumentClient)
                        .filter(Objects::nonNull)
                        .map(DocumentClient::getId)
                        .distinct()
                        .toList()
        );
    }

    private void validateInstrumentReference(CreerReglementClientRequest.Instrument request) {
        if (Set.of(
                ModeReglementClient.CHEQUE,
                ModeReglementClient.EFFET,
                ModeReglementClient.VERSEMENT_BANCAIRE
        )
                .contains(request.getMode())
                && (request.getReferenceInstrument() == null || request.getReferenceInstrument().isBlank())) {
            throw new BadRequestException(request.getMode() == ModeReglementClient.VERSEMENT_BANCAIRE
                    ? "Le numéro du bordereau bancaire est obligatoire"
                    : "La référence du moyen de règlement est obligatoire");
        }
        if (Set.of(ModeReglementClient.CHEQUE, ModeReglementClient.EFFET)
                .contains(request.getMode())
                && request.getDateEcheance() == null) {
            throw new BadRequestException("La date d'échéance est obligatoire");
        }
    }

    private void validateReceipt(MultipartFile receipt, boolean required) {
        if (receipt == null || receipt.isEmpty()) {
            if (required) {
                throw new BadRequestException("Le justificatif du bordereau bancaire est obligatoire");
            }
            return;
        }
        if (receipt.getSize() > MAX_RECEIPT_SIZE) {
            throw new BadRequestException("Le justificatif dépasse la taille maximale de 30 Mo");
        }
        String contentType = receipt.getContentType() == null
                ? "" : receipt.getContentType().toLowerCase(Locale.ROOT);
        if (!RECEIPT_CONTENT_TYPES.contains(contentType)) {
            throw new BadRequestException("Le justificatif doit être un fichier PDF, JPEG ou PNG");
        }
        if (safeReceiptFileName(receipt).length() > 255) {
            throw new BadRequestException("Le nom du justificatif ne doit pas dépasser 255 caractères");
        }
    }

    private void storeReceipt(ReglementClient payment, MultipartFile receipt) {
        String originalName = safeReceiptFileName(receipt);
        String extension = originalName.lastIndexOf('.') >= 0
                ? originalName.substring(originalName.lastIndexOf('.')).toLowerCase(Locale.ROOT)
                : "";
        String storageKey = payment.getAgence().getId() + "/" + payment.getId() + "/"
                + UUID.randomUUID() + extension;
        Path destination = storageLayoutService.resolveClientPaymentReceipt(
                payment.getAgence().getId(),
                storageKey
        );
        try {
            Files.createDirectories(destination.getParent());
            try (InputStream input = receipt.getInputStream();
                 OutputStream output = Files.newOutputStream(destination)) {
                input.transferTo(output);
            }
        } catch (IOException error) {
            throw new IllegalStateException("Impossible d'enregistrer le bordereau bancaire", error);
        }
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCompletion(int status) {
                    if (status != TransactionSynchronization.STATUS_COMMITTED) {
                        try {
                            Files.deleteIfExists(destination);
                        } catch (IOException ignored) {
                            // The database remains authoritative; orphan cleanup can retry later.
                        }
                    }
                }
            });
        }
        payment.setBordereauNomFichier(originalName);
        payment.setBordereauContentType(receipt.getContentType());
        payment.setBordereauCheminStockage(storageKey);
        payment.setBordereauTailleOctets(receipt.getSize());
    }

    private String safeReceiptFileName(MultipartFile receipt) {
        String supplied = receipt.getOriginalFilename();
        if (supplied == null || supplied.isBlank()) {
            return "bordereau";
        }
        String normalized = supplied.replace('\\', '/');
        String fileName = normalized.substring(normalized.lastIndexOf('/') + 1)
                .replaceAll("[\\p{Cntrl}]", "")
                .trim();
        return fileName.isBlank() ? "bordereau" : fileName;
    }

    private Banque resolveOriginatingBank(
            Long agenceId,
            CreerReglementClientRequest.Instrument request
    ) {
        if (!ORIGINATING_BANK_MODES.contains(request.getMode())) {
            return null;
        }
        if (request.getBanqueEmettriceId() == null) {
            throw new BadRequestException("Sélectionnez la banque d'origine du moyen de règlement");
        }
        return banqueService.requireActive(agenceId, request.getBanqueEmettriceId());
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
                if (!hasElement && !hasDocument) {
                    throw new BadRequestException(
                            "Une affectation doit cibler une créance"
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
                if (hasElement && hasDocument) {
                    DocumentClient document = documents.get(allocation.getDocumentClientId());
                    boolean belongsToDocument = document.getLignes().stream()
                            .anyMatch(line -> line.getElementFacturable().getId()
                                    .equals(allocation.getElementFacturableId()));
                    if (!belongsToDocument) {
                        throw new BadRequestException(
                                "La ligne sélectionnée n'appartient pas à cette facture"
                        );
                    }
                }
            }
        }
    }

    private String allocationTargetKey(CreerReglementClientRequest.Affectation allocation) {
        if (allocation.getElementFacturableId() != null
                && allocation.getDocumentClientId() != null) {
            return "L:" + allocation.getDocumentClientId()
                    + ":" + allocation.getElementFacturableId();
        }
        if (allocation.getElementFacturableId() != null) {
            return "E:" + allocation.getElementFacturableId();
        }
        if (allocation.getDocumentClientId() != null) {
            return "D:" + allocation.getDocumentClientId();
        }
        return "INVALID";
    }

    private List<Payer> resolvePayers(
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
        if (payers.isEmpty()) {
            throw new BadRequestException("Aucun payeur n'est associé aux créances sélectionnées");
        }
        return payers;
    }

    private Payer resolvePaymentPayer(List<Payer> payers, boolean multiPayer) {
        Payer first = payers.get(0);
        boolean severalPayers = payers.stream().anyMatch(payer -> !payer.key().equals(first.key()));
        if (!multiPayer && severalPayers) {
            throw new BadRequestException("Un règlement ne peut couvrir que les créances d'un même payeur");
        }
        return severalPayers
                ? new Payer("MULTI", null, null, "Plusieurs clients")
                : first;
    }

    private void validateMultiPayerDeposit(CreerReglementClientRequest request) {
        if (request.getClientPayeurId() != null || request.getGroupePayeurId() != null) {
            throw new BadRequestException("Un versement multi-clients ne doit pas définir un payeur unique");
        }
        if (request.getDeposantNom() == null || request.getDeposantNom().isBlank()) {
            throw new BadRequestException("Le déposant du versement bancaire est obligatoire");
        }
        if (request.getInstruments().size() != 1
                || request.getInstruments().get(0).getMode() != ModeReglementClient.VERSEMENT_BANCAIRE) {
            throw new BadRequestException(
                    "Un versement multi-clients doit contenir un seul moyen de type versement bancaire"
            );
        }
    }

    private Payer resolveAllocationPayer(
            CreerReglementClientRequest.Affectation allocation,
            Map<Long, ElementFacturable> elements,
            Map<Long, DocumentClient> documents,
            Map<Long, Client> subscribers
    ) {
        if (allocation.getDocumentClientId() != null) {
            return resolvePayer(documents.get(allocation.getDocumentClientId()));
        }
        ElementFacturable element = elements.get(allocation.getElementFacturableId());
        return resolvePayer(element.getContrat(), subscribers);
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

    @Transactional(readOnly = true)
    public ReceiptCoverage receiptCoverage(Long agenceId, Collection<Long> requestedIds) {
        List<Long> ids = requestedIds.stream().filter(Objects::nonNull).distinct().toList();
        if (ids.isEmpty()) {
            return new ReceiptCoverage(Set.of(), Set.of());
        }
        List<ElementFacturable> elements = elementRepository.findClientDocumentSources(agenceId, ids);
        List<Long> scopedIds = elements.stream().map(ElementFacturable::getId).toList();
        if (scopedIds.isEmpty()) {
            return new ReceiptCoverage(Set.of(), Set.of());
        }
        Map<Long, AllocationAmounts> amounts = new HashMap<>(loadAllocationAmounts(agenceId, scopedIds));
        Map<Long, BigDecimal> totals = elements.stream().collect(Collectors.toMap(
                ElementFacturable::getId, element -> money(element.getPrimeTotale())));
        Map<Long, DocumentClient> invoices = new LinkedHashMap<>();
        documentLineRepository.findIssuedDocumentsByElementIds(scopedIds, StatutDocumentClient.EMIS).stream()
                .map(LigneDocumentClient::getDocument)
                .filter(document -> document.getTypeDocument() == TypeDocumentClient.FACTURE
                        && agenceId.equals(document.getAgence().getId()))
                .forEach(document -> invoices.putIfAbsent(document.getId(), document));
        for (DocumentClient invoice : invoices.values()) {
            amounts.putAll(invoiceLineAllocationAmounts(invoice));
            invoice.getLignes().forEach(line -> {
                if (totals.containsKey(line.getElementFacturable().getId())) {
                    totals.put(line.getElementFacturable().getId(), money(line.getMontantTtc()));
                }
            });
        }
        Set<Long> covered = new HashSet<>();
        Set<Long> collected = new HashSet<>();
        totals.forEach((id, total) -> {
            AllocationAmounts current = amounts.getOrDefault(id, AllocationAmounts.empty());
            if (total.signum() <= 0) return;
            BigDecimal settled = current.confirmed().add(current.adjustment());
            if (settled.add(current.pending()).compareTo(total) >= 0) covered.add(id);
            if (current.pending().signum() == 0 && settled.compareTo(total) >= 0) collected.add(id);
        });
        return new ReceiptCoverage(Set.copyOf(covered), Set.copyOf(collected));
    }

    public record ReceiptCoverage(Set<Long> covered, Set<Long> collected) {
    }

    private Map<Long, AllocationAmounts> loadAllocationAmounts(Long agenceId, Collection<Long> elementIds) {
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
                    ? new AllocationAmounts(current.confirmed().add(amount), current.pending(), current.adjustment())
                    : new AllocationAmounts(current.confirmed(), current.pending().add(amount), current.adjustment()));
        }
        mergeAdjustments(result, ecartRepository.sumByElementIds(agenceId, elementIds));
        return result;
    }

    private Map<Long, AllocationAmounts> loadDocumentAllocationAmounts(Long agenceId, Collection<Long> documentIds) {
        if (documentIds.isEmpty()) {
            return Map.of();
        }
        Map<Long, AllocationAmounts> result = new HashMap<>();
        mergeAllocationRows(result, allocationRepository.sumByDocumentIds(documentIds));
        mergeAdjustments(result, ecartRepository.sumByDocumentIds(agenceId, documentIds));
        return result;
    }

    private void mergeAdjustments(Map<Long, AllocationAmounts> result, List<Object[]> rows) {
        for (Object[] row : rows) {
            Long id = (Long) row[0];
            AllocationAmounts current = result.getOrDefault(id, AllocationAmounts.empty());
            result.put(id, new AllocationAmounts(current.confirmed(), current.pending(), money((BigDecimal) row[1])));
        }
    }

    private Map<Long, AllocationAmounts> loadParentDocumentAllocationAmounts(
            Collection<Long> documentIds
    ) {
        if (documentIds.isEmpty()) {
            return Map.of();
        }
        Map<Long, AllocationAmounts> result = new HashMap<>();
        mergeAllocationRows(result, allocationRepository.sumParentByDocumentIds(documentIds));
        return result;
    }

    private void mergeAllocationRows(
            Map<Long, AllocationAmounts> result,
            List<Object[]> rows
    ) {
        for (Object[] row : rows) {
            Long documentId = (Long) row[0];
            StatutAffectationReglement status = (StatutAffectationReglement) row[1];
            BigDecimal amount = money((BigDecimal) row[2]);
            AllocationAmounts current = result.getOrDefault(
                    documentId,
                    AllocationAmounts.empty()
            );
            result.put(documentId, status == StatutAffectationReglement.CONFIRMEE
                    ? new AllocationAmounts(current.confirmed().add(amount), current.pending(), current.adjustment())
                    : new AllocationAmounts(current.confirmed(), current.pending().add(amount), current.adjustment()));
        }
    }

    private Map<Long, AllocationAmounts> invoiceLineAllocationAmounts(DocumentClient document) {
        List<LigneDocumentClient> lines = document.getLignes().stream()
                .sorted(java.util.Comparator.comparing(LigneDocumentClient::getOrdre))
                .toList();
        List<Long> elementIds = lines.stream()
                .map(line -> line.getElementFacturable().getId())
                .toList();
        Map<Long, AllocationAmounts> result = new HashMap<>(loadAllocationAmounts(document.getAgence().getId(), elementIds));
        AllocationAmounts parent = loadParentDocumentAllocationAmounts(List.of(document.getId()))
                .getOrDefault(document.getId(), AllocationAmounts.empty());
        distributeParentAmount(lines, result, parent.confirmed(), true);
        distributeParentAmount(lines, result, parent.pending(), false);
        return result;
    }

    private void distributeParentAmount(
            List<LigneDocumentClient> lines,
            Map<Long, AllocationAmounts> amounts,
            BigDecimal amount,
            boolean confirmed
    ) {
        BigDecimal remaining = money(amount);
        for (LigneDocumentClient line : lines) {
            if (remaining.signum() <= 0) {
                return;
            }
            Long elementId = line.getElementFacturable().getId();
            AllocationAmounts current = amounts.getOrDefault(elementId, AllocationAmounts.empty());
            BigDecimal capacity = money(line.getMontantTtc())
                    .subtract(current.confirmed())
                    .subtract(current.pending())
                    .subtract(current.adjustment())
                    .max(ZERO);
            BigDecimal assigned = remaining.min(capacity);
            amounts.put(elementId, confirmed
                    ? new AllocationAmounts(current.confirmed().add(assigned), current.pending(), current.adjustment())
                    : new AllocationAmounts(current.confirmed(), current.pending().add(assigned), current.adjustment()));
            remaining = remaining.subtract(assigned);
        }
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
                .dateSaisie(document.getCreatedAt().toLocalDate())
                .dateEffet(document.getDateEmission())
                .dateEcheance(document.getDateEcheance())
                .payeurType(payerType)
                .payeurId(payerId)
                .payeurNom(document.getPayeurNom())
                .primeNette(money(document.getTotalDocument()))
                .taxes(ZERO)
                .accessoires(ZERO)
                .montantTtc(money(document.getTotalDocument()))
                .montantRegle(ZERO)
                .soldeRestant(money(document.getTotalDocument()))
                .facturable(true)
                .build();
    }

    private SourceDocumentClientResponse toInvoiceLineSource(
            DocumentClient document,
            LigneDocumentClient line
    ) {
        String payerType = document.getGroupePayeur() == null ? "CLIENT" : "GROUPE";
        Long payerId = document.getGroupePayeur() == null
                ? document.getClientPayeur().getId()
                : document.getGroupePayeur().getId();
        return SourceDocumentClientResponse.builder()
                .elementFacturableId(line.getElementFacturable().getId())
                .documentClientId(document.getId())
                .nature(line.getElementFacturable().getNature())
                .quittanceId(line.getQuittance() == null ? null : line.getQuittance().getId())
                .contratId(line.getElementFacturable().getContrat().getId())
                .mouvementId(line.getElementFacturable().getMouvementContrat() == null
                        ? null : line.getElementFacturable().getMouvementContrat().getId())
                .dossier(line.getNumeroDossier())
                .police(BillableReferences.documentLine(line))
                .typeContrat(line.getElementFacturable().getContrat().getTypeContrat())
                .mouvement(line.getMouvement())
                .reference(document.getNumero())
                .referenceSource(line.getNumeroQuittance())
                .compagnie(line.getCompagnie())
                .dateEffet(line.getDateOperation())
                .dateEcheance(line.getDateEcheance())
                .payeurType(payerType)
                .payeurId(payerId)
                .payeurNom(document.getPayeurNom())
                .primeNette(money(line.getPrimeNette()))
                .taxes(money(line.getTaxes()))
                .accessoires(money(line.getAccessoires()))
                .montantTtc(money(line.getMontantTtc()))
                .montantRegle(ZERO)
                .soldeRestant(money(line.getMontantTtc()).max(ZERO))
                .dejaFacturee(true)
                .facturable(false)
                .build();
    }

    private CreanceClientPageResponse.Ligne toReceivable(
            SourceDocumentClientResponse source,
            AllocationAmounts amounts
    ) {
        BigDecimal total = money(source.getMontantTtc());
        BigDecimal open = remainingAfterAllocations(total, amounts);
        String status;
        if (amounts.confirmed().add(amounts.adjustment()).compareTo(total) >= 0) {
            status = "PAYEE";
        } else if (amounts.confirmed().add(amounts.pending()).add(amounts.adjustment()).compareTo(total) >= 0) {
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

    private void recalculateQuittancePaymentFlags(Long agenceId, Collection<Long> elementIds) {
        if (elementIds.isEmpty()) {
            return;
        }
        Map<Long, AllocationAmounts> amounts = loadAllocationAmounts(agenceId, elementIds);
        List<Quittance> quittances = quittanceRepository.findGlobalByElementFacturableIds(elementIds);
        for (Quittance quittance : quittances) {
            Long elementId = quittance.getElementFacturable().getId();
            BigDecimal total = money(quittance.getElementFacturable().getPrimeTotale());
            AllocationAmounts settled = amounts.getOrDefault(elementId, AllocationAmounts.empty());
            BigDecimal confirmed = settled.confirmed().add(settled.adjustment());
            quittance.setPayee(confirmed.compareTo(total) >= 0);
        }
        quittanceRepository.saveAll(quittances);
    }

    private void recalculatePaymentFlags(
            Long agenceId,
            Collection<Long> elementIds,
            Collection<Long> documentIds
    ) {
        recalculateQuittancePaymentFlags(agenceId, elementIds);
        Set<Long> affectedDocumentIds = new HashSet<>(documentIds);
        if (!elementIds.isEmpty()) {
            documentLineRepository.findIssuedDocumentsByElementIds(
                            elementIds,
                            StatutDocumentClient.EMIS
                    ).stream()
                    .filter(line -> line.getDocument().getTypeDocument()
                            == TypeDocumentClient.FACTURE)
                    .map(line -> line.getDocument().getId())
                    .forEach(affectedDocumentIds::add);
        }
        if (affectedDocumentIds.isEmpty()) {
            return;
        }
        List<DocumentClient> documents = documentClientRepository.findAllById(affectedDocumentIds);
        Map<Long, Boolean> paidByElement = new HashMap<>();
        for (DocumentClient document : documents) {
            Map<Long, AllocationAmounts> lineAmounts = invoiceLineAllocationAmounts(document);
            document.getLignes().forEach(line -> {
                Long elementId = line.getElementFacturable().getId();
                BigDecimal confirmed = lineAmounts.getOrDefault(
                        elementId,
                        AllocationAmounts.empty()
                ).confirmed().add(lineAmounts.getOrDefault(elementId, AllocationAmounts.empty()).adjustment());
                boolean paid = confirmed.compareTo(money(line.getMontantTtc())) >= 0;
                paidByElement.merge(elementId, paid, Boolean::logicalOr);
            });
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
        return String.format(
                Locale.ROOT,
                "REG-%02d-%06d",
                year % 100,
                sequence.getValeur()
        );
    }

    private ReglementClient findPayment(Long agenceId, Long paymentId) {
        ReglementClient payment = reglementRepository.findByIdAndAgenceId(paymentId, agenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Règlement client", paymentId));
        loadPaymentInstruments(payment, agenceId);
        return payment;
    }

    private void loadPaymentInstruments(ReglementClient payment, Long agenceId) {
        instrumentRepository.findByReglementIdAndAgenceIdOrderByIdAsc(
                payment.getId(),
                agenceId
        );
    }

    private ReglementClientResponse.Detail paymentDetail(ReglementClient payment) {
        Long agenceId = payment.getAgence().getId();
        List<AffectationReglementClient> allocations = payment.getInstruments().stream()
                .flatMap(instrument -> instrument.getAffectations().stream()).toList();
        Map<Long, DocumentClient> globalDocuments = new LinkedHashMap<>();
        Map<Long, DocumentClient> documents = new LinkedHashMap<>();
        Set<Long> elementIds = new java.util.LinkedHashSet<>();
        for (AffectationReglementClient allocation : allocations) {
            if (allocation.getElementFacturable() != null) {
                elementIds.add(allocation.getElementFacturable().getId());
            }
            DocumentClient document = allocation.getDocumentClient();
            if (document != null) {
                if (!agenceId.equals(document.getAgence().getId())) {
                    throw new ResourceNotFoundException("DocumentClient", document.getId());
                }
                documents.putIfAbsent(document.getId(), document);
                if (allocation.getElementFacturable() == null) {
                    globalDocuments.putIfAbsent(document.getId(), document);
                    document.getLignes().forEach(line -> elementIds.add(line.getElementFacturable().getId()));
                }
            }
        }
        Map<Long, SourceDocumentClientResponse> sources = new LinkedHashMap<>();
        documentClientService.findPaymentSourcesByIds(agenceId, elementIds)
                .forEach(source -> sources.put(source.getElementFacturableId(), source));
        Map<Long, AllocationAmounts> amounts = new HashMap<>(loadAllocationAmounts(agenceId, elementIds));
        documents.values().forEach(document -> amounts.putAll(invoiceLineAllocationAmounts(document)));
        Map<Long, DocumentClient> globalDocumentByElement = new HashMap<>();
        globalDocuments.values().forEach(document -> document.getLignes().forEach(line ->
                globalDocumentByElement.putIfAbsent(line.getElementFacturable().getId(), document)));
        Map<String, List<AffectationReglementClient>> grouped = new LinkedHashMap<>();
        Map<String, DocumentClient> groupedDocuments = new HashMap<>();
        for (AffectationReglementClient allocation : allocations) {
            ElementFacturable element = allocation.getElementFacturable();
            DocumentClient global = element == null ? allocation.getDocumentClient()
                    : globalDocumentByElement.get(element.getId());
            if (global == null && element == null) continue;
            String key = global == null ? "E:" + element.getId() : "D:" + global.getId();
            grouped.computeIfAbsent(key, ignored -> new ArrayList<>()).add(allocation);
            if (global != null) groupedDocuments.put(key, global);
        }
        List<ReglementClientResponse.Production> productions = new ArrayList<>();
        grouped.forEach((key, values) -> {
            AllocationAmounts current = paymentAllocationAmounts(payment, values);
            DocumentClient global = groupedDocuments.get(key);
            if (global != null) {
                List<SourceDocumentClientResponse> lines = global.getLignes().stream()
                        .map(line -> sources.get(line.getElementFacturable().getId())).filter(Objects::nonNull).toList();
                BigDecimal balance = global.getLignes().stream()
                        .map(line -> remainingAfterAllocations(money(line.getMontantTtc()),
                                amounts.getOrDefault(line.getElementFacturable().getId(), AllocationAmounts.empty())))
                        .reduce(ZERO, BigDecimal::add);
                productions.add(ReglementClientResponse.Production.builder().key(key).documentClientId(global.getId())
                        .numeroPolice(joinProductionLabels(global.getLignes().stream().map(BillableReferences::documentLine).toList()))
                        .compagnie(joinProductionLabels(global.getLignes().stream().map(LigneDocumentClient::getCompagnie).toList()))
                        .assure(joinProductionLabels(lines.stream().map(SourceDocumentClientResponse::getAssureNom).toList()))
                        .mouvement("Affectation globale au document").referenceDocument(global.getNumero())
                        .dateDebut(global.getLignes().stream().map(LigneDocumentClient::getDateOperation).filter(Objects::nonNull)
                                .min(LocalDate::compareTo).orElse(null))
                        .dateFin(global.getLignes().stream().map(LigneDocumentClient::getDateEcheance).filter(Objects::nonNull)
                                .max(LocalDate::compareTo).orElse(null))
                        .montantQuittance(money(global.getTotalDocument())).montantEncaisse(current.confirmed())
                        .montantRegle(current.confirmed().add(current.pending()))
                        .montantEnAttente(current.pending()).solde(balance).build());
                return;
            }
            AffectationReglementClient allocation = values.get(0);
            Long elementId = allocation.getElementFacturable().getId();
            SourceDocumentClientResponse source = sources.get(elementId);
            LigneDocumentClient snapshot = values.stream()
                    .sorted(java.util.Comparator.comparing((AffectationReglementClient value) ->
                            value.getStatut() == StatutAffectationReglement.ANNULEE))
                    .map(AffectationReglementClient::getDocumentClient)
                    .filter(Objects::nonNull).flatMap(document -> document.getLignes().stream())
                    .filter(line -> elementId.equals(line.getElementFacturable().getId())).findFirst().orElse(null);
            BigDecimal total = money(snapshot == null ? source.getMontantTtc() : snapshot.getMontantTtc());
            productions.add(ReglementClientResponse.Production.builder().key(key).elementFacturableId(elementId)
                    .documentClientId(allocation.getDocumentClient() == null ? null : allocation.getDocumentClient().getId())
                    .numeroPolice(snapshot == null ? source.getPolice() : BillableReferences.documentLine(snapshot))
                    .compagnie(snapshot == null ? source.getCompagnie() : snapshot.getCompagnie())
                    .assure(source.getAssureNom()).mouvement(snapshot == null ? source.getMouvement() : snapshot.getMouvement())
                    .referenceDocument(allocationDocumentReference(allocation))
                    .dateDebut(snapshot == null ? source.getDateEffet() : snapshot.getDateOperation())
                    .dateFin(snapshot == null ? source.getDateEcheance() : snapshot.getDateEcheance())
                    .montantQuittance(total).montantEncaisse(current.confirmed()).montantEnAttente(current.pending())
                    .montantRegle(current.confirmed().add(current.pending()))
                    .solde(remainingAfterAllocations(total, amounts.getOrDefault(elementId, AllocationAmounts.empty()))).build());
        });
        BigDecimal collected = ZERO;
        BigDecimal pending = ZERO;
        if (payment.getStatut() != StatutReglementClient.ANNULE) {
            for (InstrumentReglementClient instrument : payment.getInstruments()) {
                if (instrument.getStatut() == StatutInstrumentReglement.CONFIRME) {
                    collected = collected.add(money(instrument.getMontant()));
                } else if (instrument.getStatut() == StatutInstrumentReglement.EN_ATTENTE
                        || instrument.getStatut() == StatutInstrumentReglement.REMIS_EN_BANQUE) {
                    pending = pending.add(money(instrument.getMontant()));
                }
            }
        }
        return ReglementClientResponse.Detail.builder().totalEncaisse(collected).totalEnAttente(pending)
                .totalRegle(collected.add(pending))
                .totalQuittances(productions.stream().map(ReglementClientResponse.Production::getMontantQuittance)
                        .reduce(ZERO, BigDecimal::add))
                .solde(productions.stream().map(ReglementClientResponse.Production::getSolde).reduce(ZERO, BigDecimal::add))
                .productions(productions).build();
    }

    private AllocationAmounts paymentAllocationAmounts(ReglementClient payment, List<AffectationReglementClient> allocations) {
        BigDecimal confirmed = ZERO;
        BigDecimal pending = ZERO;
        if (payment.getStatut() != StatutReglementClient.ANNULE) {
            for (AffectationReglementClient allocation : allocations) {
                StatutInstrumentReglement status = allocation.getInstrument().getStatut();
                if (allocation.getStatut() == StatutAffectationReglement.CONFIRMEE && status == StatutInstrumentReglement.CONFIRME) {
                    confirmed = confirmed.add(money(allocation.getMontant()));
                } else if (allocation.getStatut() == StatutAffectationReglement.EN_ATTENTE
                        && (status == StatutInstrumentReglement.EN_ATTENTE || status == StatutInstrumentReglement.REMIS_EN_BANQUE)) {
                    pending = pending.add(money(allocation.getMontant()));
                }
            }
        }
        return new AllocationAmounts(confirmed, pending, ZERO);
    }

    private String joinProductionLabels(List<String> labels) {
        return labels.stream().filter(Objects::nonNull).filter(label -> !label.isBlank()).distinct()
                .collect(java.util.stream.Collectors.joining("\n"));
    }

    private BigDecimal remainingAfterAllocations(BigDecimal total, AllocationAmounts amounts) {
        return total.subtract(amounts.confirmed()).subtract(amounts.pending()).subtract(amounts.adjustment()).max(ZERO);
    }

    private ReglementClientResponse toResponse(ReglementClient payment) {
        return toResponse(payment, remittanceLinesWithHistory(payment.getInstruments().stream()
                .map(InstrumentReglementClient::getId)
                .toList()));
    }

    private ReglementClientResponse toResponse(
            ReglementClient payment,
            Map<Long, LigneBordereauRemise> remittanceLines
    ) {
        Map<Long, String> assistanceNumbers = assistanceNumbers(payment.getAgence().getId(), payment.getInstruments());
        return ReglementClientResponse.builder()
                .id(payment.getId())
                .numero(payment.getNumero())
                .dateReglement(payment.getDateReglement())
                .clientPayeurId(payment.getClientPayeur() == null ? null : payment.getClientPayeur().getId())
                .groupePayeurId(payment.getGroupePayeur() == null ? null : payment.getGroupePayeur().getId())
                .payeurNom(payment.getPayeurNom())
                .multiPayeur(payment.getMultiPayeur())
                .deposantNom(payment.getDeposantNom())
                .bordereauNomFichier(payment.getBordereauNomFichier())
                .bordereauContentType(payment.getBordereauContentType())
                .bordereauTailleOctets(payment.getBordereauTailleOctets())
                .statut(payment.getStatut())
                .montantTotal(payment.getMontantTotal())
                .montantNonAffecte(payment.getMontantNonAffecte())
                .notes(payment.getNotes())
                .quittancePrimeNumero(payment.getQuittancePrimeNumero())
                .quittancePrimeDateEmission(payment.getQuittancePrimeDateEmission())
                .creeParId(payment.getCreePar().getId())
                .creePar(payment.getCreePar().getFullName())
                .modifieParId(payment.getUpdatedByUserId())
                .valideParId(payment.getValidePar() == null ? null : payment.getValidePar().getId())
                .validePar(payment.getValidePar() == null ? null : payment.getValidePar().getFullName())
                .dateValidation(payment.getDateValidation())
                .instruments(payment.getInstruments().stream()
                        .map(instrument -> toInstrumentResponse(
                                instrument,
                                remittanceLines.get(instrument.getId()), assistanceNumbers
                        ))
                        .toList())
                .build();
    }

    private ReglementClientResponse.Instrument toInstrumentResponse(
            InstrumentReglementClient instrument,
            LigneBordereauRemise remittanceLine,
            Map<Long, String> assistanceNumbers
    ) {
        return ReglementClientResponse.Instrument.builder()
                .id(instrument.getId())
                .reglementId(instrument.getReglement().getId())
                .clientPayeurId(instrument.getReglement().getClientPayeur() == null
                        ? null : instrument.getReglement().getClientPayeur().getId())
                .numeroReglement(instrument.getReglement().getNumero())
                .statutReglement(instrument.getReglement().getStatut())
                .payeurNom(instrument.getReglement().getPayeurNom())
                .mode(instrument.getMode())
                .statut(instrument.getStatut())
                .montant(instrument.getMontant())
                .dateInstrument(instrument.getDateInstrument())
                .dateReglement(instrument.getReglement().getDateReglement())
                .dateEcheance(instrument.getDateEcheance())
                .dateStatut(instrument.getDateStatut())
                .referenceInstrument(instrument.getReferenceInstrument())
                .banqueEmettriceId(instrument.getBanqueEmettriceReference() == null
                        ? null : instrument.getBanqueEmettriceReference().getId())
                .banqueEmettriceCode(instrument.getBanqueEmettriceReference() == null
                        ? null : instrument.getBanqueEmettriceReference().getCode())
                .banqueEmettrice(instrument.getBanqueEmettriceReference() == null
                        ? null : instrument.getBanqueEmettriceReference().getLibelle())
                .reglementBureau(instrument.getReglementBureau())
                .motifStatut(instrument.getMotifStatut())
                .dateRejet(instrument.getDateRejet())
                .motifRejet(instrument.getMotifRejet())
                .instrumentRemplaceId(instrument.getInstrumentRemplace() == null
                        ? null : instrument.getInstrumentRemplace().getId())
                .modeInstrumentRemplace(instrument.getInstrumentRemplace() == null
                        ? null : instrument.getInstrumentRemplace().getMode())
                .referenceInstrumentRemplace(instrument.getInstrumentRemplace() == null
                        ? null : instrument.getInstrumentRemplace().getReferenceInstrument())
                .compteTresorerieId(instrument.getCompteTresorerie() == null
                        ? null : instrument.getCompteTresorerie().getId())
                .compteTresorerie(instrument.getCompteTresorerie() == null
                        ? null : instrument.getCompteTresorerie().getLibelle())
                .bordereauRemiseId(remittanceLine == null
                        ? null : remittanceLine.getBordereau().getId())
                .numeroBordereauRemise(remittanceLine == null
                        ? null : remittanceLine.getBordereau().getNumero())
                .statutBordereauRemise(remittanceLine == null
                        ? null : remittanceLine.getBordereau().getStatut())
                .affectations(instrument.getAffectations().stream()
                        .map(allocation -> ReglementClientResponse.Affectation.builder()
                                .id(allocation.getId())
                                .elementFacturableId(allocation.getElementFacturable() == null
                                        ? null : allocation.getElementFacturable().getId())
                                .documentClientId(allocation.getDocumentClient() == null
                                        ? null : allocation.getDocumentClient().getId())
                                .payeurType(allocation.getGroupePayeur() == null ? "CLIENT" : "GROUPE")
                                .payeurId(allocation.getGroupePayeur() == null
                                        ? allocation.getClientPayeur() == null
                                                ? null : allocation.getClientPayeur().getId()
                                        : allocation.getGroupePayeur().getId())
                                .payeurNom(allocation.getPayeurNomSnapshot())
                                .destination(allocationDestination(allocation, assistanceNumbers))
                                .numeroPolice(BillableReferences.allocation(allocation, assistanceNumbers))
                                .mouvement(allocation.getElementFacturable() == null
                                        ? "Affectation globale au document" : allocation.getElementFacturable().getLibelle())
                                .referenceDocument(allocationDocumentReference(allocation))
                                .montant(allocation.getMontant())
                                .statut(allocation.getStatut())
                                .build())
                        .toList())
                .build();
    }

    private Map<Long, LigneBordereauRemise> remittanceLinesWithHistory(List<Long> instrumentIds) {
        Map<Long, LigneBordereauRemise> lines = activeRemittanceLines(instrumentIds);
        if (!instrumentIds.isEmpty()) {
            remittanceLineRepository.findHistoryByInstrumentIds(instrumentIds)
                    .forEach(line -> lines.putIfAbsent(line.getInstrument().getId(), line));
        }
        return lines;
    }

    private String allocationDestination(AffectationReglementClient allocation, Map<Long, String> assistanceNumbers) {
        DocumentClient document = allocation.getDocumentClient();
        ElementFacturable element = allocation.getElementFacturable();
        if (document != null) {
            String documentLabel = switch (document.getTypeDocument()) {
                case FACTURE -> "Facture ";
                case RELEVE -> "Relevé ";
            };
            return joinLabels(documentLabel + document.getNumero(), allocation.getElementFacturable() == null
                    ? null : joinLabels(element.getLibelle(), BillableReferences.allocation(allocation, assistanceNumbers)));
        }
        return elementReference(element, assistanceNumbers);
    }

    private Map<Long, String> assistanceNumbers(Long agenceId, Collection<InstrumentReglementClient> instruments) {
        Set<Long> ids = BillableReferences.assistanceElementIds(instruments);
        return ids.isEmpty() ? Map.of() : BillableReferences.assistanceNumbers(
                assistanceRepository.findForPaymentHistory(agenceId, ids));
    }

    private String allocationDocumentReference(AffectationReglementClient allocation) {
        DocumentClient document = allocation.getDocumentClient();
        if (document == null) {
            return null;
        }
        String label = switch (document.getTypeDocument()) {
            case FACTURE -> "Facture ";
            case RELEVE -> "Relevé ";
        };
        return label + document.getNumero();
    }

    private String elementReference(ElementFacturable element, Map<Long, String> assistanceNumbers) {
        if (element == null) {
            return "-";
        }
        Contrat contract = element.getContrat();
        String contractReference = contract == null ? null
                : joinLabels(BillableReferences.element(element, assistanceNumbers), contract.getNumeroDossier());
        return joinLabels(element.getLibelle(), contractReference);
    }

    private String joinLabels(String first, String second) {
        boolean firstPresent = first != null && !first.isBlank();
        boolean secondPresent = second != null && !second.isBlank();
        if (!firstPresent) {
            return secondPresent ? second.trim() : "-";
        }
        return secondPresent ? first.trim() + " · " + second.trim() : first.trim();
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

    private List<Long> distinctIds(Collection<Long> ids) {
        return ids == null ? List.of() : ids.stream()
                .filter(Objects::nonNull)
                .distinct()
                .toList();
    }

    private BigDecimal money(BigDecimal value) {
        return (value == null ? BigDecimal.ZERO : value).setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal maxSettlementAdjustment(Long agenceId) {
        BigDecimal configured = parametreApplicationService.getDecimal(agenceId, "REGLEMENT_CLIENT_ECART_MAX", ZERO);
        return configured == null || configured.signum() < 0 ? ZERO : money(configured);
    }

    private BigDecimal maxUnallocatedCredit(Long agenceId) {
        BigDecimal configured = parametreApplicationService.getDecimal(
                agenceId,
                MAX_UNALLOCATED_CREDIT_PARAMETER,
                DEFAULT_MAX_UNALLOCATED_CREDIT
        );
        return configured == null || configured.signum() < 0
                ? DEFAULT_MAX_UNALLOCATED_CREDIT
                : money(configured);
    }

    private String normalizeSearch(String value) {
        return value == null || value.isBlank() ? null : value.trim().toLowerCase(Locale.ROOT);
    }

    private String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private record AllocationAmounts(BigDecimal confirmed, BigDecimal pending, BigDecimal adjustment) {
        private static AllocationAmounts empty() {
            return new AllocationAmounts(ZERO, ZERO, ZERO);
        }
    }

    private record Payer(String key, Client client, GroupeClient group, String name) {
    }

    public record DownloadedReceipt(Resource resource, MediaType mediaType, String fileName) {
    }
}
