package com.assurance.controller;

import com.assurance.dto.response.ApiResponse;
import com.assurance.dto.response.ContratResponse;
import com.assurance.security.TenantContext;
import com.assurance.service.VehiculeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/vehicules")
@RequiredArgsConstructor
public class VehiculeController {

    private final VehiculeService vehiculeService;

    @GetMapping("/search")
    @PreAuthorize("hasAnyAuthority('PERM_vehicule:view', 'PERM_contrat:view', 'PERM_contrat:create', 'PERM_contrat:update')")
    public ResponseEntity<ApiResponse<ContratResponse.VehiculeView>> search(
            @RequestParam(required = false) String immatriculation
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                vehiculeService.searchByImmatriculation(TenantContext.getCurrentAgence(), immatriculation).orElse(null)
        ));
    }
}
