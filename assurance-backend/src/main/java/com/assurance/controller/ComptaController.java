package com.assurance.controller;

import com.assurance.dto.request.EnregistrerAffectationQuittanceRequest;
import com.assurance.dto.request.UpsertRegleAffectationQuittanceRequest;
import com.assurance.dto.response.AffectationQuittancePageResponse;
import com.assurance.dto.response.AffectationQuittanceResponse;
import com.assurance.dto.response.ApiResponse;
import com.assurance.dto.response.ElementFacturableResponse;
import com.assurance.dto.response.ImportAffectationQuittancePreviewResponse;
import com.assurance.dto.response.RegleAffectationQuittancePageResponse;
import com.assurance.dto.response.RegleAffectationQuittanceResponse;
import com.assurance.enums.NatureAffectationQuittance;
import com.assurance.enums.TypeContrat;
import com.assurance.security.TenantContext;
import com.assurance.service.AffectationQuittanceService;
import com.assurance.service.ElementFacturableService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/v1/compta")
@RequiredArgsConstructor
public class ComptaController {

    private final ElementFacturableService elementFacturableService;
    private final AffectationQuittanceService affectationQuittanceService;

    @GetMapping("/elements-facturables")
    @PreAuthorize("hasAuthority('PERM_quittance:view')")
    public ResponseEntity<ApiResponse<List<ElementFacturableResponse>>> elementsFacturables() {
        return ResponseEntity.ok(ApiResponse.success(elementFacturableService.list(TenantContext.getCurrentAgence())));
    }

    @GetMapping("/quittances")
    @PreAuthorize("hasAuthority('PERM_quittance:view')")
    public ResponseEntity<ApiResponse<AffectationQuittancePageResponse>> quittances(
            @RequestParam(required = false) Long compagnieId,
            @RequestParam(required = false) TypeContrat typeContrat,
            @RequestParam(required = false) NatureAffectationQuittance nature,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateDu,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateAu,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size
    ) {
        return ResponseEntity.ok(ApiResponse.success(affectationQuittanceService.search(
                TenantContext.getCurrentAgence(),
                compagnieId,
                typeContrat,
                nature,
                dateDu,
                dateAu,
                search,
                page,
                size
        )));
    }

    @GetMapping("/quittances/{quittanceId}/affectation")
    @PreAuthorize("hasAuthority('PERM_quittance:view')")
    public ResponseEntity<ApiResponse<AffectationQuittanceResponse>> affectation(
            @PathVariable Long quittanceId,
            @RequestParam(required = false) Boolean avecRetenue
    ) {
        return ResponseEntity.ok(ApiResponse.success(affectationQuittanceService.detail(
                TenantContext.getCurrentAgence(),
                quittanceId,
                avecRetenue
        )));
    }

    @PutMapping("/quittances/{quittanceId}/affectation")
    @PreAuthorize("hasAnyAuthority('PERM_quittance:create', 'PERM_quittance:manage')")
    public ResponseEntity<ApiResponse<AffectationQuittanceResponse>> enregistrerAffectation(
            @PathVariable Long quittanceId,
            @Valid @RequestBody EnregistrerAffectationQuittanceRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                affectationQuittanceService.save(
                        TenantContext.getCurrentAgence(),
                        TenantContext.getCurrentUser(),
                        quittanceId,
                        request
                ),
                "Affectation de la quittance enregistrée"
        ));
    }

    @DeleteMapping("/quittances/{quittanceId}/affectation")
    @PreAuthorize("hasAnyAuthority('PERM_quittance:create', 'PERM_quittance:manage')")
    public ResponseEntity<ApiResponse<Void>> supprimerAffectation(@PathVariable Long quittanceId) {
        affectationQuittanceService.clear(TenantContext.getCurrentAgence(), quittanceId);
        return ResponseEntity.ok(ApiResponse.success(null, "Affectation supprimée"));
    }

    @PostMapping("/quittances/{quittanceId}/imports/previsualisation")
    @PreAuthorize("hasAnyAuthority('PERM_quittance:create', 'PERM_quittance:manage')")
    public ResponseEntity<ApiResponse<ImportAffectationQuittancePreviewResponse>> previsualiserImport(
            @PathVariable Long quittanceId,
            @RequestParam boolean avecRetenue,
            @RequestParam("file") MultipartFile file
    ) {
        return ResponseEntity.ok(ApiResponse.success(affectationQuittanceService.previewImport(
                TenantContext.getCurrentAgence(),
                quittanceId,
                avecRetenue,
                file
        )));
    }

    @GetMapping("/regles-quittances")
    @PreAuthorize("hasAuthority('PERM_quittance:view')")
    public ResponseEntity<ApiResponse<RegleAffectationQuittancePageResponse>> reglesQuittances(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                affectationQuittanceService.listRules(TenantContext.getCurrentAgence(), page, size)
        ));
    }

    @PostMapping("/regles-quittances")
    @PreAuthorize("hasAnyAuthority('PERM_quittance:manage', 'PERM_config:manage')")
    public ResponseEntity<ApiResponse<RegleAffectationQuittanceResponse>> creerRegleQuittance(
            @Valid @RequestBody UpsertRegleAffectationQuittanceRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                affectationQuittanceService.createRule(TenantContext.getCurrentAgence(), request),
                "Règle d'affectation créée"
        ));
    }

    @PutMapping("/regles-quittances/{ruleId}")
    @PreAuthorize("hasAnyAuthority('PERM_quittance:manage', 'PERM_config:manage')")
    public ResponseEntity<ApiResponse<RegleAffectationQuittanceResponse>> modifierRegleQuittance(
            @PathVariable Long ruleId,
            @Valid @RequestBody UpsertRegleAffectationQuittanceRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                affectationQuittanceService.updateRule(TenantContext.getCurrentAgence(), ruleId, request),
                "Règle d'affectation modifiée"
        ));
    }

    @DeleteMapping("/regles-quittances/{ruleId}")
    @PreAuthorize("hasAnyAuthority('PERM_quittance:manage', 'PERM_config:manage')")
    public ResponseEntity<ApiResponse<Void>> supprimerRegleQuittance(@PathVariable Long ruleId) {
        affectationQuittanceService.deleteRule(TenantContext.getCurrentAgence(), ruleId);
        return ResponseEntity.ok(ApiResponse.success(null, "Règle d'affectation supprimée"));
    }
}
