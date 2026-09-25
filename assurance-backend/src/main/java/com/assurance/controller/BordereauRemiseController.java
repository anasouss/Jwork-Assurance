package com.assurance.controller;

import com.assurance.dto.request.CreerBordereauRemiseRequest;
import com.assurance.dto.request.DeposerBordereauRemiseRequest;
import com.assurance.dto.request.TraiterLigneBordereauRemiseRequest;
import com.assurance.dto.response.ApiResponse;
import com.assurance.dto.response.BordereauRemisePageResponse;
import com.assurance.dto.response.BordereauRemiseResponse;
import com.assurance.dto.response.InstrumentReglementPageResponse;
import com.assurance.enums.StatutBordereauRemise;
import com.assurance.enums.TypeBordereauRemise;
import com.assurance.security.TenantContext;
import com.assurance.service.BordereauRemiseService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/v1/compta/tresorerie/bordereaux-remise")
@RequiredArgsConstructor
public class BordereauRemiseController {

    private final BordereauRemiseService bordereauRemiseService;

    @GetMapping("/instruments-eligibles")
    @PreAuthorize("hasAuthority('PERM_tresorerie:view')")
    public ResponseEntity<ApiResponse<InstrumentReglementPageResponse>> eligibleInstruments(
            @RequestParam(required = false) TypeBordereauRemise type,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateDu,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateAu,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size
    ) {
        return ResponseEntity.ok(ApiResponse.success(bordereauRemiseService.eligibleInstruments(
                TenantContext.getCurrentAgence(),
                type,
                dateDu,
                dateAu,
                search,
                page,
                size
        )));
    }

    @GetMapping
    @PreAuthorize("hasAuthority('PERM_tresorerie:view')")
    public ResponseEntity<ApiResponse<BordereauRemisePageResponse>> search(
            @RequestParam(required = false) TypeBordereauRemise type,
            @RequestParam(required = false) StatutBordereauRemise statut,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateDu,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateAu,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size
    ) {
        return ResponseEntity.ok(ApiResponse.success(bordereauRemiseService.search(
                TenantContext.getCurrentAgence(),
                type,
                statut,
                dateDu,
                dateAu,
                search,
                page,
                size
        )));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('PERM_tresorerie:view')")
    public ResponseEntity<ApiResponse<BordereauRemiseResponse>> detail(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(bordereauRemiseService.detail(
                TenantContext.getCurrentAgence(),
                id
        )));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('PERM_tresorerie:manage')")
    public ResponseEntity<ApiResponse<BordereauRemiseResponse>> create(
            @Valid @RequestBody CreerBordereauRemiseRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(bordereauRemiseService.create(
                TenantContext.getCurrentAgence(),
                request
        ), "Bordereau de remise créé"));
    }

    @PostMapping("/versements-especes")
    @PreAuthorize("hasAuthority('PERM_tresorerie:manage')")
    public ResponseEntity<ApiResponse<BordereauRemiseResponse>> createCashDeposit(
            @Valid @RequestBody CreerBordereauRemiseRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(bordereauRemiseService.createCashDeposit(
                TenantContext.getCurrentAgence(),
                request
        ), "Versement d'espèces enregistré"));
    }

    @PostMapping("/{id}/depot")
    @PreAuthorize("hasAuthority('PERM_tresorerie:manage')")
    public ResponseEntity<ApiResponse<BordereauRemiseResponse>> deposit(
            @PathVariable Long id,
            @Valid @RequestBody DeposerBordereauRemiseRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(bordereauRemiseService.deposit(
                TenantContext.getCurrentAgence(),
                id,
                request
        ), "Bordereau déposé"));
    }

    @PostMapping("/{bordereauId}/lignes/{lineId}/encaissement")
    @PreAuthorize("hasAuthority('PERM_tresorerie:manage')")
    public ResponseEntity<ApiResponse<BordereauRemiseResponse>> settleLine(
            @PathVariable Long bordereauId,
            @PathVariable Long lineId,
            @Valid @RequestBody TraiterLigneBordereauRemiseRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(bordereauRemiseService.settleLine(
                TenantContext.getCurrentAgence(),
                bordereauId,
                lineId,
                request
        ), "Instrument encaissé"));
    }

    @PostMapping("/{bordereauId}/lignes/{lineId}/rejet")
    @PreAuthorize("hasAuthority('PERM_tresorerie:manage')")
    public ResponseEntity<ApiResponse<BordereauRemiseResponse>> rejectLine(
            @PathVariable Long bordereauId,
            @PathVariable Long lineId,
            @Valid @RequestBody TraiterLigneBordereauRemiseRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(bordereauRemiseService.rejectLine(
                TenantContext.getCurrentAgence(),
                bordereauId,
                lineId,
                request
        ), "Instrument rejeté"));
    }

    @PostMapping("/{id}/annulation")
    @PreAuthorize("hasAuthority('PERM_tresorerie:manage')")
    public ResponseEntity<ApiResponse<BordereauRemiseResponse>> cancel(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(bordereauRemiseService.cancel(
                TenantContext.getCurrentAgence(),
                id
        ), "Bordereau annulé"));
    }
}
