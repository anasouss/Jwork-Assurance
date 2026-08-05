package com.assurance.controller;

import com.assurance.dto.request.UpsertExpertSinistreRequest;
import com.assurance.dto.request.UpsertGarageSinistreRequest;
import com.assurance.dto.response.ApiResponse;
import com.assurance.dto.response.SinistreIntervenantResponse;
import com.assurance.security.TenantContext;
import com.assurance.service.SinistreIntervenantService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
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

import java.util.List;

@RestController
@RequestMapping("/api/v1/sinistres/referentiels")
@RequiredArgsConstructor
public class SinistreReferentielController {

    private final SinistreIntervenantService intervenantService;

    @GetMapping("/experts")
    @PreAuthorize("hasAnyAuthority('PERM_sinistre:view', 'PERM_sinistre:manage', 'PERM_sinistre:referentiel')")
    public ResponseEntity<ApiResponse<List<SinistreIntervenantResponse>>> listExperts(
            @RequestParam(defaultValue = "false") boolean includeInactive
    ) {
        return ResponseEntity.ok(ApiResponse.success(intervenantService.listExperts(
                TenantContext.getCurrentAgence(),
                includeInactive
        )));
    }

    @PostMapping("/experts")
    @PreAuthorize("hasAuthority('PERM_sinistre:referentiel')")
    public ResponseEntity<ApiResponse<SinistreIntervenantResponse>> createExpert(
            @Valid @RequestBody UpsertExpertSinistreRequest request
    ) {
        return saveExpert(null, request);
    }

    @PutMapping("/experts/{id}")
    @PreAuthorize("hasAuthority('PERM_sinistre:referentiel')")
    public ResponseEntity<ApiResponse<SinistreIntervenantResponse>> updateExpert(
            @PathVariable Long id,
            @Valid @RequestBody UpsertExpertSinistreRequest request
    ) {
        return saveExpert(id, request);
    }

    @GetMapping("/garages")
    @PreAuthorize("hasAnyAuthority('PERM_sinistre:view', 'PERM_sinistre:manage', 'PERM_sinistre:referentiel')")
    public ResponseEntity<ApiResponse<List<SinistreIntervenantResponse>>> listGarages(
            @RequestParam(defaultValue = "false") boolean includeInactive
    ) {
        return ResponseEntity.ok(ApiResponse.success(intervenantService.listGarages(
                TenantContext.getCurrentAgence(),
                includeInactive
        )));
    }

    @PostMapping("/garages")
    @PreAuthorize("hasAuthority('PERM_sinistre:referentiel')")
    public ResponseEntity<ApiResponse<SinistreIntervenantResponse>> createGarage(
            @Valid @RequestBody UpsertGarageSinistreRequest request
    ) {
        return saveGarage(null, request);
    }

    @PutMapping("/garages/{id}")
    @PreAuthorize("hasAuthority('PERM_sinistre:referentiel')")
    public ResponseEntity<ApiResponse<SinistreIntervenantResponse>> updateGarage(
            @PathVariable Long id,
            @Valid @RequestBody UpsertGarageSinistreRequest request
    ) {
        return saveGarage(id, request);
    }

    private ResponseEntity<ApiResponse<SinistreIntervenantResponse>> saveExpert(
            Long id,
            UpsertExpertSinistreRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(intervenantService.saveExpert(
                TenantContext.getCurrentAgence(),
                id,
                request
        ), "Expert enregistré"));
    }

    private ResponseEntity<ApiResponse<SinistreIntervenantResponse>> saveGarage(
            Long id,
            UpsertGarageSinistreRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(intervenantService.saveGarage(
                TenantContext.getCurrentAgence(),
                id,
                request
        ), "Garage enregistré"));
    }
}
