package com.assurance.controller;

import com.assurance.dto.response.ApiResponse;
import com.assurance.dto.response.SinistreContratLookupResponse;
import com.assurance.enums.TypeRechercheContratSinistre;
import com.assurance.security.TenantContext;
import com.assurance.service.SinistreContratLookupService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/sinistres/contrats")
@RequiredArgsConstructor
public class SinistreContratLookupController {

    private final SinistreContratLookupService lookupService;

    @GetMapping
    @PreAuthorize("hasAnyAuthority('PERM_sinistre:create', 'PERM_sinistre:view', 'PERM_sinistre:manage')")
    public ResponseEntity<ApiResponse<List<SinistreContratLookupResponse>>> search(
            @RequestParam Long brancheId,
            @RequestParam String query,
            @RequestParam(defaultValue = "POLICE") TypeRechercheContratSinistre typeRecherche
    ) {
        return ResponseEntity.ok(ApiResponse.success(lookupService.search(TenantContext.getCurrentAgence(), brancheId, query, typeRecherche)));
    }
}
