package com.assurance.controller;

import com.assurance.dto.request.AddProvisionSinistreRequest;
import com.assurance.dto.request.AddSinistreOperationRequest;
import com.assurance.dto.request.AddSinistrePartieRequest;
import com.assurance.dto.request.CreateSinistreRequest;
import com.assurance.dto.request.TransitionSinistreRequest;
import com.assurance.dto.request.UpdateSinistreGarantieRequest;
import com.assurance.dto.request.UpdateSinistreRequest;
import com.assurance.dto.request.UpsertMissionExpertiseRequest;
import com.assurance.dto.response.ApiResponse;
import com.assurance.dto.response.PagedResponse;
import com.assurance.dto.response.SinistreCouverturePreviewResponse;
import com.assurance.dto.response.SinistreDashboardResponse;
import com.assurance.dto.response.SinistreDetailResponse;
import com.assurance.dto.response.SinistreSummaryResponse;
import com.assurance.enums.NatureSinistre;
import com.assurance.enums.StatutSinistre;
import com.assurance.security.TenantContext;
import com.assurance.service.SinistreCouvertureService;
import com.assurance.service.SinistreDashboardService;
import com.assurance.service.SinistreDossierService;
import com.assurance.service.SinistreService;
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

import java.time.LocalDate;

@RestController
@RequestMapping("/api/v1/sinistres")
@RequiredArgsConstructor
public class SinistreController {

    private final SinistreService sinistreService;
    private final SinistreDossierService dossierService;
    private final SinistreCouvertureService couvertureService;
    private final SinistreDashboardService dashboardService;

    @GetMapping("/dashboard")
    @PreAuthorize("hasAnyAuthority('PERM_sinistre:view', 'PERM_sinistre:manage', 'PERM_sinistre:finance')")
    public ResponseEntity<ApiResponse<SinistreDashboardResponse>> dashboard() {
        return ResponseEntity.ok(ApiResponse.success(
                dashboardService.get(TenantContext.getCurrentAgence())
        ));
    }

    @GetMapping("/couverture")
    @PreAuthorize("hasAnyAuthority('PERM_sinistre:view', 'PERM_sinistre:create', 'PERM_sinistre:manage')")
    public ResponseEntity<ApiResponse<SinistreCouverturePreviewResponse>> previewCoverage(
            @RequestParam Long contratId,
            @RequestParam LocalDate dateSinistre
    ) {
        return ResponseEntity.ok(ApiResponse.success(couvertureService.preview(
                TenantContext.getCurrentAgence(),
                contratId,
                dateSinistre
        )));
    }

    @GetMapping
    @PreAuthorize("hasAnyAuthority('PERM_sinistre:view', 'PERM_sinistre:manage', 'PERM_sinistre:finance')")
    public ResponseEntity<ApiResponse<PagedResponse<SinistreSummaryResponse>>> list(
            @RequestParam(required = false) String query,
            @RequestParam(required = false) StatutSinistre statut,
            @RequestParam(required = false) NatureSinistre nature,
            @RequestParam(required = false) LocalDate dateDu,
            @RequestParam(required = false) LocalDate dateAu,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size
    ) {
        return ResponseEntity.ok(ApiResponse.success(sinistreService.list(
                TenantContext.getCurrentAgence(),
                query,
                statut,
                nature,
                dateDu,
                dateAu,
                page,
                size
        )));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('PERM_sinistre:create')")
    public ResponseEntity<ApiResponse<SinistreDetailResponse>> create(
            @Valid @RequestBody CreateSinistreRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(sinistreService.create(
                TenantContext.getCurrentAgence(),
                TenantContext.getCurrentUser(),
                request
        ), "Sinistre enregistré"));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('PERM_sinistre:view', 'PERM_sinistre:manage', 'PERM_sinistre:finance')")
    public ResponseEntity<ApiResponse<SinistreDetailResponse>> get(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(
                sinistreService.get(TenantContext.getCurrentAgence(), id)
        ));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('PERM_sinistre:manage')")
    public ResponseEntity<ApiResponse<SinistreDetailResponse>> update(
            @PathVariable Long id,
            @Valid @RequestBody UpdateSinistreRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(sinistreService.update(
                TenantContext.getCurrentAgence(),
                TenantContext.getCurrentUser(),
                id,
                request
        ), "Sinistre mis à jour"));
    }

    @PostMapping("/{id}/transition")
    @PreAuthorize("hasAuthority('PERM_sinistre:manage')")
    public ResponseEntity<ApiResponse<SinistreDetailResponse>> transition(
            @PathVariable Long id,
            @Valid @RequestBody TransitionSinistreRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(sinistreService.transition(
                TenantContext.getCurrentAgence(),
                TenantContext.getCurrentUser(),
                id,
                request
        ), "Statut du sinistre mis à jour"));
    }

    @PutMapping("/{id}/garanties/{garantieId}")
    @PreAuthorize("hasAuthority('PERM_sinistre:manage')")
    public ResponseEntity<ApiResponse<SinistreDetailResponse>> updateGuarantee(
            @PathVariable Long id,
            @PathVariable Long garantieId,
            @Valid @RequestBody UpdateSinistreGarantieRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(dossierService.updateGuarantee(
                TenantContext.getCurrentAgence(),
                TenantContext.getCurrentUser(),
                id,
                garantieId,
                request
        ), "Garantie mise à jour"));
    }

    @PostMapping("/{id}/parties")
    @PreAuthorize("hasAuthority('PERM_sinistre:manage')")
    public ResponseEntity<ApiResponse<SinistreDetailResponse>> addParty(
            @PathVariable Long id,
            @Valid @RequestBody AddSinistrePartieRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(dossierService.addParty(
                TenantContext.getCurrentAgence(),
                TenantContext.getCurrentUser(),
                id,
                request
        ), "Partie impliquée ajoutée"));
    }

    @DeleteMapping("/{id}/parties/{partieId}")
    @PreAuthorize("hasAuthority('PERM_sinistre:manage')")
    public ResponseEntity<ApiResponse<SinistreDetailResponse>> deleteParty(
            @PathVariable Long id,
            @PathVariable Long partieId
    ) {
        return ResponseEntity.ok(ApiResponse.success(dossierService.deleteParty(
                TenantContext.getCurrentAgence(),
                TenantContext.getCurrentUser(),
                id,
                partieId
        ), "Partie impliquée retirée"));
    }

    @PostMapping("/{id}/provisions")
    @PreAuthorize("hasAuthority('PERM_sinistre:finance')")
    public ResponseEntity<ApiResponse<SinistreDetailResponse>> addProvision(
            @PathVariable Long id,
            @Valid @RequestBody AddProvisionSinistreRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(dossierService.addProvision(
                TenantContext.getCurrentAgence(),
                TenantContext.getCurrentUser(),
                id,
                request
        ), "Provision enregistrée"));
    }

    @PostMapping("/{id}/missions")
    @PreAuthorize("hasAuthority('PERM_sinistre:manage')")
    public ResponseEntity<ApiResponse<SinistreDetailResponse>> createMission(
            @PathVariable Long id,
            @Valid @RequestBody UpsertMissionExpertiseRequest request
    ) {
        return saveMission(id, null, request);
    }

    @PutMapping("/{id}/missions/{missionId}")
    @PreAuthorize("hasAuthority('PERM_sinistre:manage')")
    public ResponseEntity<ApiResponse<SinistreDetailResponse>> updateMission(
            @PathVariable Long id,
            @PathVariable Long missionId,
            @Valid @RequestBody UpsertMissionExpertiseRequest request
    ) {
        return saveMission(id, missionId, request);
    }

    @PostMapping("/{id}/operations")
    @PreAuthorize("hasAuthority('PERM_sinistre:finance')")
    public ResponseEntity<ApiResponse<SinistreDetailResponse>> addOperation(
            @PathVariable Long id,
            @Valid @RequestBody AddSinistreOperationRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(dossierService.addOperation(
                TenantContext.getCurrentAgence(),
                TenantContext.getCurrentUser(),
                id,
                request
        ), "Opération financière enregistrée"));
    }

    @PostMapping("/{id}/operations/{operationId}/annulation")
    @PreAuthorize("hasAuthority('PERM_sinistre:finance')")
    public ResponseEntity<ApiResponse<SinistreDetailResponse>> cancelOperation(
            @PathVariable Long id,
            @PathVariable Long operationId,
            @RequestParam(required = false) String motif
    ) {
        return ResponseEntity.ok(ApiResponse.success(dossierService.cancelOperation(
                TenantContext.getCurrentAgence(),
                TenantContext.getCurrentUser(),
                id,
                operationId,
                motif
        ), "Opération financière annulée"));
    }

    private ResponseEntity<ApiResponse<SinistreDetailResponse>> saveMission(
            Long id,
            Long missionId,
            UpsertMissionExpertiseRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(dossierService.saveMission(
                TenantContext.getCurrentAgence(),
                TenantContext.getCurrentUser(),
                id,
                missionId,
                request
        ), "Mission d'expertise enregistrée"));
    }
}
