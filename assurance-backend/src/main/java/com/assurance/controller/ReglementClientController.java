package com.assurance.controller;

import com.assurance.dto.request.AnnulerReglementClientRequest;
import com.assurance.dto.request.ChangerStatutInstrumentReglementRequest;
import com.assurance.dto.request.CreerReglementClientRequest;
import com.assurance.dto.request.RemplacerInstrumentReglementRequest;
import com.assurance.dto.response.ApiResponse;
import com.assurance.dto.response.CreanceClientPageResponse;
import com.assurance.dto.response.ReglementClientPageResponse;
import com.assurance.dto.response.ReglementClientResponse;
import com.assurance.enums.TypeContrat;
import com.assurance.security.TenantContext;
import com.assurance.service.ReglementClientService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/v1/compta/reglements-clients")
@RequiredArgsConstructor
public class ReglementClientController {

    private final ReglementClientService reglementClientService;

    @GetMapping("/creances")
    @PreAuthorize("hasAuthority('PERM_reglement-client:view')")
    public ResponseEntity<ApiResponse<CreanceClientPageResponse>> receivables(
            @RequestParam(required = false) String payeurType,
            @RequestParam(required = false) Long payeurId,
            @RequestParam(required = false) Long brancheId,
            @RequestParam(required = false) TypeContrat typeContrat,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateDu,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateAu,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size
    ) {
        return ResponseEntity.ok(ApiResponse.success(reglementClientService.searchReceivables(
                TenantContext.getCurrentAgence(),
                payeurType,
                payeurId,
                brancheId,
                typeContrat,
                dateDu,
                dateAu,
                search,
                page,
                size
        )));
    }

    @GetMapping("/creances/factures")
    @PreAuthorize("hasAuthority('PERM_reglement-client:view')")
    public ResponseEntity<ApiResponse<CreanceClientPageResponse>> invoiceReceivables(
            @RequestParam(required = false) String payeurType,
            @RequestParam(required = false) Long payeurId,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateDu,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateAu,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                reglementClientService.searchInvoiceReceivables(
                        TenantContext.getCurrentAgence(),
                        payeurType,
                        payeurId,
                        dateDu,
                        dateAu,
                        search,
                        page,
                        size
                )
        ));
    }

    @GetMapping
    @PreAuthorize("hasAuthority('PERM_reglement-client:view')")
    public ResponseEntity<ApiResponse<ReglementClientPageResponse>> payments(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateDu,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateAu,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size
    ) {
        return ResponseEntity.ok(ApiResponse.success(reglementClientService.searchPayments(
                TenantContext.getCurrentAgence(),
                dateDu,
                dateAu,
                search,
                page,
                size
        )));
    }

    @GetMapping("/{paymentId}")
    @PreAuthorize("hasAuthority('PERM_reglement-client:view')")
    public ResponseEntity<ApiResponse<ReglementClientResponse>> payment(@PathVariable Long paymentId) {
        return ResponseEntity.ok(ApiResponse.success(reglementClientService.detail(
                TenantContext.getCurrentAgence(),
                paymentId
        )));
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
}
