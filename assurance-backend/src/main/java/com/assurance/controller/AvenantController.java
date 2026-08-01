package com.assurance.controller;

import com.assurance.dto.request.AvenantRequest;
import com.assurance.dto.response.ApiResponse;
import com.assurance.dto.response.AvenantContextResponse;
import com.assurance.dto.response.AvenantDetailResponse;
import com.assurance.dto.response.AvenantDraftResponse;
import com.assurance.dto.response.ContratActionsResponse;
import com.assurance.dto.response.QuittanceResponse;
import com.assurance.security.TenantContext;
import com.assurance.service.avenant.AvenantApplicationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
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

import java.util.List;

@RestController
@RequestMapping("/api/v1/contrats/{contratId}/avenants")
@RequiredArgsConstructor
public class AvenantController {

    private final AvenantApplicationService avenantApplicationService;

    @GetMapping({"", "/context"})
    @PreAuthorize("hasAnyAuthority('PERM_avenant:view', 'PERM_contrat:view')")
    public ResponseEntity<ApiResponse<AvenantContextResponse>> context(@PathVariable Long contratId) {
        return ResponseEntity.ok(ApiResponse.success(
                avenantApplicationService.getContext(TenantContext.getCurrentAgence(), contratId)
        ));
    }

    @GetMapping("/types")
    @PreAuthorize("hasAnyAuthority('PERM_avenant:view', 'PERM_contrat:view')")
    public ResponseEntity<ApiResponse<List<ContratActionsResponse.MouvementDisponible>>> availableTypes(
            @PathVariable Long contratId
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                avenantApplicationService.getAvailableTypes(TenantContext.getCurrentAgence(), contratId)
        ));
    }

    @GetMapping("/{mouvementId:\\d+}")
    @PreAuthorize("hasAnyAuthority('PERM_avenant:view', 'PERM_contrat:view')")
    public ResponseEntity<ApiResponse<AvenantDetailResponse>> detail(
            @PathVariable Long contratId,
            @PathVariable Long mouvementId
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                avenantApplicationService.getDetail(TenantContext.getCurrentAgence(), contratId, mouvementId)
        ));
    }

    @GetMapping("/brouillon")
    @PreAuthorize("hasAnyAuthority('PERM_avenant:view', 'PERM_contrat:view')")
    public ResponseEntity<ApiResponse<AvenantDraftResponse>> draft(
            @PathVariable Long contratId,
            @RequestParam String code
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                avenantApplicationService.getDraft(TenantContext.getCurrentAgence(), contratId, code)
        ));
    }

    @PutMapping({"/brouillon", "/{code}/brouillon"})
    @PreAuthorize("hasAnyAuthority('PERM_avenant:draft', 'PERM_contrat:update')")
    public ResponseEntity<ApiResponse<AvenantDraftResponse>> saveDraft(
            @PathVariable Long contratId,
            @PathVariable(required = false) String code,
            @RequestBody AvenantRequest request
    ) {
        String resolvedCode = code == null && request != null ? request.getCodeTypeMouvement() : code;
        return ResponseEntity.ok(ApiResponse.success(
                avenantApplicationService.saveDraft(
                        TenantContext.getCurrentAgence(), contratId, resolvedCode, request
                ),
                "Brouillon d'avenant enregistre"
        ));
    }

    @DeleteMapping({"/brouillon", "/{code}/brouillon"})
    @PreAuthorize("hasAnyAuthority('PERM_avenant:draft', 'PERM_contrat:update')")
    public ResponseEntity<ApiResponse<Void>> deleteDraft(
            @PathVariable Long contratId,
            @PathVariable(required = false) String code,
            @RequestParam(name = "code", required = false) String codeParam
    ) {
        avenantApplicationService.deleteDraft(
                TenantContext.getCurrentAgence(), contratId, code == null ? codeParam : code
        );
        return ResponseEntity.ok(ApiResponse.success(null, "Brouillon d'avenant supprime"));
    }

    @GetMapping("/{mouvementId:\\d+}/rectification")
    @PreAuthorize("hasAnyAuthority('PERM_avenant:view', 'PERM_contrat:view')")
    public ResponseEntity<ApiResponse<AvenantRequest>> rectification(
            @PathVariable Long contratId,
            @PathVariable Long mouvementId
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                avenantApplicationService.getRectification(TenantContext.getCurrentAgence(), contratId, mouvementId)
        ));
    }

    @PutMapping({"/{mouvementId:\\d+}/rectification", "/{mouvementId:\\d+}/{code}/rectification"})
    @PreAuthorize("hasAnyAuthority('PERM_avenant:rectify', 'PERM_contrat:update')")
    public ResponseEntity<ApiResponse<QuittanceResponse>> rectify(
            @PathVariable Long contratId,
            @PathVariable Long mouvementId,
            @PathVariable(required = false) String code,
            @Valid @RequestBody AvenantRequest request
    ) {
        String resolvedCode = code == null ? request.getCodeTypeMouvement() : code;
        return ResponseEntity.ok(ApiResponse.success(
                avenantApplicationService.rectify(
                        TenantContext.getCurrentAgence(), contratId, mouvementId, resolvedCode, request
                ),
                "Avenant rectifie"
        ));
    }

    @PostMapping("/{code}/preview")
    @PreAuthorize("hasAnyAuthority('PERM_avenant:create', 'PERM_avenant:rectify', 'PERM_contrat:update')")
    public ResponseEntity<ApiResponse<QuittanceResponse>> preview(
            @PathVariable Long contratId,
            @PathVariable String code,
            @RequestParam(required = false) Long mouvementId,
            @Valid @RequestBody AvenantRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                avenantApplicationService.preview(
                        TenantContext.getCurrentAgence(), contratId, code, request, mouvementId
                )
        ));
    }

    @PostMapping("/previsualisation-quittance")
    @PreAuthorize("hasAnyAuthority('PERM_avenant:create', 'PERM_avenant:rectify', 'PERM_contrat:update')")
    public ResponseEntity<ApiResponse<QuittanceResponse>> previewLegacy(
            @PathVariable Long contratId,
            @RequestParam(required = false) Long mouvementId,
            @Valid @RequestBody AvenantRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                avenantApplicationService.previewLegacy(
                        TenantContext.getCurrentAgence(), contratId, request, mouvementId
                )
        ));
    }

    @PostMapping("/{code}")
    @PreAuthorize("hasAnyAuthority('PERM_avenant:create', 'PERM_contrat:update')")
    public ResponseEntity<ApiResponse<QuittanceResponse>> create(
            @PathVariable Long contratId,
            @PathVariable String code,
            @Valid @RequestBody AvenantRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                avenantApplicationService.create(TenantContext.getCurrentAgence(), contratId, code, request),
                "Avenant cree"
        ));
    }

    @PostMapping
    @PreAuthorize("hasAnyAuthority('PERM_avenant:create', 'PERM_contrat:update')")
    public ResponseEntity<ApiResponse<QuittanceResponse>> createLegacy(
            @PathVariable Long contratId,
            @Valid @RequestBody AvenantRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                avenantApplicationService.createLegacy(TenantContext.getCurrentAgence(), contratId, request),
                "Avenant cree"
        ));
    }
}
