package com.assurance.controller;

import com.assurance.dto.request.AnnulerBordereauCompagnieRequest;
import com.assurance.dto.request.ChangerStatutInstrumentCompagnieRequest;
import com.assurance.dto.request.CreerBordereauCompagnieRequest;
import com.assurance.dto.request.CreerReglementCompagnieRequest;
import com.assurance.dto.request.ModifierBordereauCompagnieRequest;
import com.assurance.dto.request.RapprocherBordereauCompagnieRequest;
import com.assurance.dto.request.TransmettreBordereauCompagnieRequest;
import com.assurance.dto.response.ApiResponse;
import com.assurance.dto.response.BordereauCompagniePageResponse;
import com.assurance.dto.response.BordereauCompagnieResponse;
import com.assurance.dto.response.ReglementCompagnieResponse;
import com.assurance.dto.response.SourceBordereauCompagnieResponse;
import com.assurance.enums.BaseBordereauCompagnie;
import com.assurance.enums.StatutBordereauCompagnie;
import com.assurance.security.TenantContext;
import com.assurance.service.BordereauCompagnieService;
import com.assurance.service.ReglementCompagnieService;
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
@RequestMapping("/api/v1/compta/bordereaux-compagnies")
@RequiredArgsConstructor
public class BordereauCompagnieController {

    private final BordereauCompagnieService bordereauService;
    private final ReglementCompagnieService reglementService;

    @GetMapping("/sources")
    @PreAuthorize("hasAuthority('PERM_bordereau-compagnie:view')")
    public ResponseEntity<ApiResponse<List<SourceBordereauCompagnieResponse>>> sources(
            @RequestParam(required = false) Long compagnieId,
            @RequestParam(defaultValue = "EMISSION") BaseBordereauCompagnie base,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateDu,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateAu,
            @RequestParam(required = false) String search
    ) {
        return ResponseEntity.ok(ApiResponse.success(bordereauService.eligibleSources(
                TenantContext.getCurrentAgence(),
                compagnieId,
                base,
                dateDu,
                dateAu,
                search
        )));
    }

    @GetMapping
    @PreAuthorize("hasAuthority('PERM_bordereau-compagnie:view')")
    public ResponseEntity<ApiResponse<BordereauCompagniePageResponse>> search(
            @RequestParam(required = false) Long compagnieId,
            @RequestParam(required = false) StatutBordereauCompagnie statut,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateDu,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateAu,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size
    ) {
        return ResponseEntity.ok(ApiResponse.success(bordereauService.search(
                TenantContext.getCurrentAgence(),
                compagnieId,
                statut,
                dateDu,
                dateAu,
                search,
                page,
                size
        )));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('PERM_bordereau-compagnie:view')")
    public ResponseEntity<ApiResponse<BordereauCompagnieResponse>> detail(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(
                bordereauService.get(TenantContext.getCurrentAgence(), id)
        ));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('PERM_bordereau-compagnie:create')")
    public ResponseEntity<ApiResponse<BordereauCompagnieResponse>> create(
            @Valid @RequestBody CreerBordereauCompagnieRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                bordereauService.create(TenantContext.getCurrentAgence(), request),
                "Bordereau compagnie créé"
        ));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('PERM_bordereau-compagnie:create')")
    public ResponseEntity<ApiResponse<BordereauCompagnieResponse>> update(
            @PathVariable Long id,
            @Valid @RequestBody ModifierBordereauCompagnieRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                bordereauService.update(TenantContext.getCurrentAgence(), id, request),
                "Bordereau compagnie modifié"
        ));
    }

    @PostMapping("/{id}/validation")
    @PreAuthorize("hasAuthority('PERM_bordereau-compagnie:validate')")
    public ResponseEntity<ApiResponse<BordereauCompagnieResponse>> validate(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(
                bordereauService.validate(TenantContext.getCurrentAgence(), id),
                "Bordereau compagnie validé"
        ));
    }

    @PostMapping("/{id}/transmission")
    @PreAuthorize("hasAuthority('PERM_bordereau-compagnie:transmit')")
    public ResponseEntity<ApiResponse<BordereauCompagnieResponse>> transmit(
            @PathVariable Long id,
            @Valid @RequestBody TransmettreBordereauCompagnieRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                bordereauService.transmit(TenantContext.getCurrentAgence(), id, request),
                "Transmission enregistrée"
        ));
    }

    @PostMapping("/{id}/rapprochement")
    @PreAuthorize("hasAuthority('PERM_bordereau-compagnie:reconcile')")
    public ResponseEntity<ApiResponse<BordereauCompagnieResponse>> reconcile(
            @PathVariable Long id,
            @Valid @RequestBody RapprocherBordereauCompagnieRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                bordereauService.reconcile(TenantContext.getCurrentAgence(), id, request),
                "Rapprochement enregistré"
        ));
    }

    @PostMapping("/{id}/annulation")
    @PreAuthorize("hasAuthority('PERM_bordereau-compagnie:cancel')")
    public ResponseEntity<ApiResponse<BordereauCompagnieResponse>> cancel(
            @PathVariable Long id,
            @Valid @RequestBody AnnulerBordereauCompagnieRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                bordereauService.cancel(TenantContext.getCurrentAgence(), id, request),
                "Bordereau compagnie annulé"
        ));
    }

    @PostMapping("/reglements")
    @PreAuthorize("hasAuthority('PERM_reglement-compagnie:create')")
    public ResponseEntity<ApiResponse<ReglementCompagnieResponse>> createPayment(
            @Valid @RequestBody CreerReglementCompagnieRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                reglementService.create(TenantContext.getCurrentAgence(), request),
                "Règlement compagnie enregistré"
        ));
    }

    @GetMapping("/reglements/{id}")
    @PreAuthorize("hasAuthority('PERM_reglement-compagnie:view')")
    public ResponseEntity<ApiResponse<ReglementCompagnieResponse>> payment(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(
                reglementService.get(TenantContext.getCurrentAgence(), id)
        ));
    }

    @PutMapping("/instruments/{id}/statut")
    @PreAuthorize("hasAuthority('PERM_reglement-compagnie:manage')")
    public ResponseEntity<ApiResponse<ReglementCompagnieResponse>> changePaymentStatus(
            @PathVariable Long id,
            @Valid @RequestBody ChangerStatutInstrumentCompagnieRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                reglementService.changeInstrumentStatus(
                        TenantContext.getCurrentAgence(),
                        id,
                        request
                ),
                "Statut du règlement compagnie mis à jour"
        ));
    }

    @PostMapping("/reglements/{id}/annulation")
    @PreAuthorize("hasAuthority('PERM_reglement-compagnie:manage')")
    public ResponseEntity<ApiResponse<ReglementCompagnieResponse>> cancelPayment(
            @PathVariable Long id,
            @Valid @RequestBody AnnulerBordereauCompagnieRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                reglementService.cancel(TenantContext.getCurrentAgence(), id, request),
                "Règlement compagnie annulé"
        ));
    }
}
