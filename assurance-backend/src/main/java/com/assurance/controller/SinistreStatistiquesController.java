package com.assurance.controller;

import com.assurance.dto.response.ApiResponse;
import com.assurance.dto.response.SinistreStatistiquesResponse;
import com.assurance.security.TenantContext;
import com.assurance.service.SinistreStatistiquesService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/sinistres/statistiques")
@RequiredArgsConstructor
public class SinistreStatistiquesController {

    private final SinistreStatistiquesService statistiquesService;

    @GetMapping
    @PreAuthorize("hasAnyAuthority('PERM_sinistre:view', 'PERM_sinistre:manage', 'PERM_sinistre:finance')")
    public ResponseEntity<ApiResponse<SinistreStatistiquesResponse>> get(@RequestParam(required = false) Integer annee) {
        return ResponseEntity.ok(ApiResponse.success(statistiquesService.get(TenantContext.getCurrentAgence(), annee)));
    }
}
