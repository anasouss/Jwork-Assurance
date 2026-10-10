package com.assurance.controller;

import com.assurance.dto.request.UpsertBanqueRequest;
import com.assurance.dto.response.ApiResponse;
import com.assurance.dto.response.BanqueResponse;
import com.assurance.security.TenantContext;
import com.assurance.service.BanqueService;
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
@RequestMapping("/api/v1/compta/banques")
@RequiredArgsConstructor
public class BanqueController {

    private final BanqueService banqueService;

    @GetMapping
    @PreAuthorize("hasAnyAuthority('PERM_reglement-client:view', 'PERM_reglement-client:create', 'PERM_reglement-client:manage', 'PERM_tresorerie:view', 'PERM_tresorerie:manage')")
    public ResponseEntity<ApiResponse<List<BanqueResponse>>> list(
            @RequestParam(defaultValue = "false") boolean inclureInactives
    ) {
        return ResponseEntity.ok(ApiResponse.success(banqueService.list(
                TenantContext.getCurrentAgence(),
                inclureInactives
        )));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('PERM_tresorerie:manage')")
    public ResponseEntity<ApiResponse<BanqueResponse>> create(
            @Valid @RequestBody UpsertBanqueRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(banqueService.create(
                TenantContext.getCurrentAgence(),
                request
        ), "Banque créée"));
    }

    @PutMapping("/{bankId}")
    @PreAuthorize("hasAuthority('PERM_tresorerie:manage')")
    public ResponseEntity<ApiResponse<BanqueResponse>> update(
            @PathVariable Long bankId,
            @Valid @RequestBody UpsertBanqueRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(banqueService.update(
                TenantContext.getCurrentAgence(),
                bankId,
                request
        ), "Banque modifiée"));
    }
}
