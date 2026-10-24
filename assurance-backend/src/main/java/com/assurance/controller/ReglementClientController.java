package com.assurance.controller;

import com.assurance.dto.request.AnnulerReglementClientRequest;
import com.assurance.dto.request.ChangerStatutInstrumentReglementRequest;
import com.assurance.dto.request.CreerReglementClientRequest;
import com.assurance.dto.request.RemplacerInstrumentReglementRequest;
import com.assurance.dto.request.RepresenterInstrumentReglementRequest;
import com.assurance.dto.request.SelectionCreancesClientRequest;
import com.assurance.dto.request.UpdateReglementClientPolicyRequest;
import com.assurance.dto.request.ValiderReglementsClientsRequest;
import com.assurance.dto.response.ApiResponse;
import com.assurance.dto.response.CreanceClientPageResponse;
import com.assurance.dto.response.DocumentClientResponse;
import com.assurance.dto.response.InstrumentReglementPageResponse;
import com.assurance.dto.response.ReglementClientPageResponse;
import com.assurance.dto.response.ReglementClientPolicyResponse;
import com.assurance.dto.response.ReglementClientResponse;
import com.assurance.dto.response.UtilisateurTresorerieResponse;
import com.assurance.enums.ModeReglementClient;
import com.assurance.enums.StatutReglementClient;
import com.assurance.enums.TypeContrat;
import com.assurance.enums.StatutInstrumentReglement;
import com.assurance.security.TenantContext;
import com.assurance.service.JournalReglementsPdfService;
import com.assurance.service.ReglementClientPdfService;
import com.assurance.service.ReglementClientService;
import com.assurance.service.TresorerieAccessService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/v1/compta/reglements-clients")
@RequiredArgsConstructor
public class ReglementClientController {

    private final ReglementClientService reglementClientService;
    private final ReglementClientPdfService reglementClientPdfService;
    private final JournalReglementsPdfService journalReglementsPdfService;
    private final TresorerieAccessService tresorerieAccessService;

    @GetMapping("/creances")
    @PreAuthorize("hasAuthority('PERM_reglement-client:view')")
    public ResponseEntity<ApiResponse<CreanceClientPageResponse>> receivables(
            @RequestParam(required = false) String payeurType,
            @RequestParam(required = false) Long payeurId,
            @RequestParam(required = false) Long souscripteurId,
            @RequestParam(required = false) Long contratId,
            @RequestParam(required = false) Long brancheId,
            @RequestParam(required = false) Long compagnieId,
            @RequestParam(required = false) Long compagnieAssistanceId,
            @RequestParam(required = false) TypeContrat typeContrat,
            @RequestParam(defaultValue = "EFFET") String typeDate,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateDu,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateAu,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "DATE") String sortBy,
            @RequestParam(defaultValue = "DESC") String sortDirection,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size
    ) {
        return ResponseEntity.ok(ApiResponse.success(reglementClientService.searchReceivables(
                TenantContext.getCurrentAgence(),
                payeurType,
                payeurId,
                souscripteurId,
                contratId,
                brancheId,
                compagnieId,
                compagnieAssistanceId,
                typeContrat,
                typeDate,
                dateDu,
                dateAu,
                search,
                sortBy,
                sortDirection,
                page,
                size
        )));
    }

    @GetMapping("/creances/factures")
    @PreAuthorize("hasAuthority('PERM_reglement-client:view')")
    public ResponseEntity<ApiResponse<CreanceClientPageResponse>> invoiceReceivables(
            @RequestParam(required = false) String payeurType,
            @RequestParam(required = false) Long payeurId,
            @RequestParam(required = false) Long brancheId,
            @RequestParam(required = false) Long compagnieId,
            @RequestParam(required = false) Long compagnieAssistanceId,
            @RequestParam(defaultValue = "EFFET") String typeDate,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateDu,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateAu,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "DATE") String sortBy,
            @RequestParam(defaultValue = "DESC") String sortDirection,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                reglementClientService.searchInvoiceReceivables(
                        TenantContext.getCurrentAgence(),
                        payeurType,
                        payeurId,
                        brancheId,
                        compagnieId,
                        compagnieAssistanceId,
                        typeDate,
                        dateDu,
                        dateAu,
                        search,
                        sortBy,
                        sortDirection,
                        page,
                        size
                )
        ));
    }

    @PostMapping("/creances/selection")
    @PreAuthorize("hasAuthority('PERM_reglement-client:view')")
    public ResponseEntity<ApiResponse<List<CreanceClientPageResponse.Ligne>>> selectedReceivables(
            @Valid @RequestBody SelectionCreancesClientRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(reglementClientService.selectedReceivables(
                TenantContext.getCurrentAgence(),
                request
        )));
    }

    @GetMapping("/politique")
    @PreAuthorize("hasAnyAuthority('PERM_reglement-client:view', 'PERM_reglement-client:manage')")
    public ResponseEntity<ApiResponse<ReglementClientPolicyResponse>> paymentPolicy() {
        return ResponseEntity.ok(ApiResponse.success(reglementClientService.paymentPolicy(
                TenantContext.getCurrentAgence()
        )));
    }

    @PutMapping("/politique")
    @PreAuthorize("hasAuthority('PERM_reglement-client:manage')")
    public ResponseEntity<ApiResponse<ReglementClientPolicyResponse>> updatePaymentPolicy(
            @Valid @RequestBody UpdateReglementClientPolicyRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(reglementClientService.updatePaymentPolicy(
                TenantContext.getCurrentAgence(),
                request.getCreditNonAffecteMaximum()
        )));
    }

    @GetMapping
    @PreAuthorize("hasAuthority('PERM_reglement-client:view')")
    public ResponseEntity<ApiResponse<ReglementClientPageResponse>> payments(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateDu,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateAu,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) StatutReglementClient statut,
            @RequestParam(required = false) ModeReglementClient mode,
            @RequestParam(required = false) StatutInstrumentReglement statutInstrument,
            @RequestParam(defaultValue = "dateReglement") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDirection,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size
    ) {
        return ResponseEntity.ok(ApiResponse.success(reglementClientService.searchPayments(
                TenantContext.getCurrentAgence(),
                dateDu,
                dateAu,
                statut,
                mode,
                statutInstrument,
                search,
                sortBy,
                sortDirection,
                page,
                size
        )));
    }

    @GetMapping("/journal/utilisateurs")
    @PreAuthorize("hasAuthority('PERM_reglement-client:view')")
    public ResponseEntity<ApiResponse<List<UtilisateurTresorerieResponse>>> journalUsers() {
        return ResponseEntity.ok(ApiResponse.success(tresorerieAccessService.listAgencyUsers(
                TenantContext.getCurrentAgence()
        )));
    }

    @GetMapping("/journal/pdf")
    @PreAuthorize("hasAuthority('PERM_reglement-client:view')")
    public ResponseEntity<byte[]> paymentJournalPdf(
            @RequestParam
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateDu,
            @RequestParam
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateAu,
            @RequestParam(required = false) Long utilisateurId,
            @RequestParam(required = false) ModeReglementClient mode,
            @RequestParam(required = false) StatutReglementClient statut
    ) {
        byte[] pdf = journalReglementsPdfService.generate(
                TenantContext.getCurrentAgence(),
                dateDu,
                dateAu,
                utilisateurId,
                mode,
                statut
        );
        String filename = "journal-reglements-" + dateDu + "-" + dateAu + ".pdf";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=" + filename)
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }

    @GetMapping("/{paymentId}")
    @PreAuthorize("hasAuthority('PERM_reglement-client:view')")
    public ResponseEntity<ApiResponse<ReglementClientResponse>> payment(@PathVariable Long paymentId) {
        return ResponseEntity.ok(ApiResponse.success(reglementClientService.detail(
                TenantContext.getCurrentAgence(),
                paymentId
        )));
    }

    @GetMapping("/{paymentId}/pdf")
    @PreAuthorize("hasAuthority('PERM_reglement-client:view')")
    public ResponseEntity<byte[]> paymentPdf(@PathVariable Long paymentId) {
        ReglementClientResponse detail = reglementClientService.detail(
                TenantContext.getCurrentAgence(),
                paymentId
        );
        byte[] pdf = reglementClientPdfService.generate(
                TenantContext.getCurrentAgence(),
                paymentId
        );
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "inline; filename=" + detail.getNumero() + ".pdf")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }

    @PostMapping
    @PreAuthorize("hasAnyAuthority('PERM_reglement-client:create', 'PERM_reglement-client:manage')")
    public ResponseEntity<ApiResponse<ReglementClientResponse>> create(
            @Valid @RequestBody CreerReglementClientRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(reglementClientService.create(
                TenantContext.getCurrentAgence(),
                TenantContext.getCurrentUser(),
                request
        ), "Règlement client enregistré"));
    }

    @PostMapping(value = "/versements-bancaires", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyAuthority('PERM_reglement-client:create', 'PERM_reglement-client:manage')")
    public ResponseEntity<ApiResponse<ReglementClientResponse>> createDirectDeposit(
            @Valid @RequestPart("request") CreerReglementClientRequest request,
            @RequestPart("bordereau") MultipartFile receipt
    ) {
        return ResponseEntity.ok(ApiResponse.success(reglementClientService.createDirectDeposit(
                TenantContext.getCurrentAgence(),
                TenantContext.getCurrentUser(),
                request,
                receipt
        ), "Versement bancaire enregistré"));
    }

    @GetMapping("/{paymentId}/bordereau")
    @PreAuthorize("hasAuthority('PERM_reglement-client:view')")
    public ResponseEntity<Resource> downloadDirectDepositReceipt(@PathVariable Long paymentId) {
        ReglementClientService.DownloadedReceipt download = reglementClientService.downloadReceipt(
                TenantContext.getCurrentAgence(),
                paymentId
        );
        return ResponseEntity.ok()
                .contentType(download.mediaType())
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(download.fileName())
                        .build()
                        .toString())
                .body(download.resource());
    }

    @PutMapping("/{paymentId}")
    @PreAuthorize("hasAnyAuthority('PERM_reglement-client:create', 'PERM_reglement-client:manage')")
    public ResponseEntity<ApiResponse<ReglementClientResponse>> update(
            @PathVariable Long paymentId,
            @Valid @RequestBody CreerReglementClientRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(reglementClientService.updatePending(
                TenantContext.getCurrentAgence(),
                TenantContext.getCurrentUser(),
                paymentId,
                request
        ), "Règlement à valider modifié"));
    }

    @PostMapping("/{paymentId}/validation")
    @PreAuthorize("hasAuthority('PERM_reglement-client:validate')")
    public ResponseEntity<ApiResponse<ReglementClientResponse>> validate(
            @PathVariable Long paymentId
    ) {
        return ResponseEntity.ok(ApiResponse.success(reglementClientService.validatePending(
                TenantContext.getCurrentAgence(),
                TenantContext.getCurrentUser(),
                paymentId
        ), "Règlement client validé"));
    }

    @PostMapping("/validation-groupee")
    @PreAuthorize("hasAuthority('PERM_reglement-client:validate')")
    public ResponseEntity<ApiResponse<List<ReglementClientResponse>>> validateBatch(
            @Valid @RequestBody ValiderReglementsClientsRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(reglementClientService.validatePendingBatch(
                TenantContext.getCurrentAgence(),
                TenantContext.getCurrentUser(),
                request.getReglementIds()
        ), "Règlements clients validés"));
    }

    @PostMapping("/{paymentId}/facture")
    @PreAuthorize("hasAnyAuthority('PERM_quittance:create', 'PERM_quittance:manage')")
    public ResponseEntity<ApiResponse<DocumentClientResponse>> createInvoice(
            @PathVariable Long paymentId
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                reglementClientService.createInvoiceFromPayment(
                        TenantContext.getCurrentAgence(),
                        paymentId
                ),
                "Facture émise"
        ));
    }

    @PostMapping("/{paymentId}/annulation")
    @PreAuthorize("hasAuthority('PERM_reglement-client:manage')")
    public ResponseEntity<ApiResponse<ReglementClientResponse>> cancel(
            @PathVariable Long paymentId,
            @Valid @RequestBody AnnulerReglementClientRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(reglementClientService.cancel(
                TenantContext.getCurrentAgence(),
                paymentId,
                request
        ), "Règlement client annulé"));
    }

    @GetMapping("/instruments/en-attente")
    @PreAuthorize("hasAuthority('PERM_tresorerie:view')")
    public ResponseEntity<ApiResponse<List<ReglementClientResponse.Instrument>>> pendingInstruments() {
        return ResponseEntity.ok(ApiResponse.success(reglementClientService.pendingInstruments(
                TenantContext.getCurrentAgence()
        )));
    }

    @GetMapping("/instruments")
    @PreAuthorize("hasAuthority('PERM_tresorerie:view')")
    public ResponseEntity<ApiResponse<InstrumentReglementPageResponse>> instruments(
            @RequestParam(required = false) StatutInstrumentReglement statut,
            @RequestParam(required = false) List<StatutInstrumentReglement> statuts,
            @RequestParam(required = false) ModeReglementClient mode,
            @RequestParam(required = false) List<ModeReglementClient> modes,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateDu,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateAu,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "DUE") String sortBy,
            @RequestParam(defaultValue = "ASC") String sortDirection,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size
    ) {
        return ResponseEntity.ok(ApiResponse.success(reglementClientService.searchInstruments(
                TenantContext.getCurrentAgence(),
                statuts == null || statuts.isEmpty()
                        ? List.of(statut == null ? StatutInstrumentReglement.EN_ATTENTE : statut)
                        : statuts,
                modes == null || modes.isEmpty()
                        ? mode == null ? List.of(ModeReglementClient.values()) : List.of(mode)
                        : modes,
                dateDu,
                dateAu,
                search,
                sortBy,
                sortDirection,
                page,
                size
        )));
    }

    @PutMapping("/instruments/{instrumentId}/statut")
    @PreAuthorize("hasAuthority('PERM_tresorerie:manage')")
    public ResponseEntity<ApiResponse<ReglementClientResponse>> changeInstrumentStatus(
            @PathVariable Long instrumentId,
            @Valid @RequestBody ChangerStatutInstrumentReglementRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(reglementClientService.changeInstrumentStatus(
                TenantContext.getCurrentAgence(),
                instrumentId,
                request
        ), "Statut du moyen de règlement mis à jour"));
    }

    @PostMapping("/instruments/{instrumentId}/remplacement")
    @PreAuthorize("hasAuthority('PERM_reglement-client:manage')")
    public ResponseEntity<ApiResponse<ReglementClientResponse>> replaceInstrument(
            @PathVariable Long instrumentId,
            @Valid @RequestBody RemplacerInstrumentReglementRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(reglementClientService.replaceInstrument(
                TenantContext.getCurrentAgence(),
                instrumentId,
                request
        ), "Instrument remplacé"));
    }

    @PostMapping("/instruments/{instrumentId}/representation")
    @PreAuthorize("hasAuthority('PERM_reglement-client:manage')")
    public ResponseEntity<ApiResponse<ReglementClientResponse>> representInstrument(
            @PathVariable Long instrumentId,
            @Valid @RequestBody RepresenterInstrumentReglementRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(reglementClientService.representInstrument(
                TenantContext.getCurrentAgence(),
                instrumentId,
                request
        ), "Instrument prêt pour une nouvelle remise"));
    }
}
