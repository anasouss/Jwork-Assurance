package com.assurance.controller;

import com.assurance.dto.request.UpsertGroupeClientRequest;
import com.assurance.dto.response.ApiResponse;
import com.assurance.dto.response.GroupeClientResponse;
import com.assurance.security.TenantContext;
import com.assurance.service.GroupeClientService;
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
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/groupes-clients")
@RequiredArgsConstructor
public class GroupeClientController {

    private final GroupeClientService groupeClientService;

    @GetMapping
    @PreAuthorize("hasAnyAuthority('PERM_client:view', 'PERM_contrat:create', 'PERM_contrat:update', 'PERM_quittance:view')")
    public ResponseEntity<ApiResponse<List<GroupeClientResponse>>> list() {
        return ResponseEntity.ok(ApiResponse.success(groupeClientService.list(TenantContext.getCurrentAgence())));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('PERM_client:view', 'PERM_contrat:create', 'PERM_contrat:update', 'PERM_quittance:view')")
    public ResponseEntity<ApiResponse<GroupeClientResponse>> get(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(groupeClientService.get(TenantContext.getCurrentAgence(), id)));
    }

    @PostMapping
    @PreAuthorize("hasAnyAuthority('PERM_client:manage', 'PERM_client:create')")
    public ResponseEntity<ApiResponse<GroupeClientResponse>> create(@Valid @RequestBody UpsertGroupeClientRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                groupeClientService.create(TenantContext.getCurrentAgence(), request),
                "Groupe client cree"
        ));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('PERM_client:manage', 'PERM_client:create')")
    public ResponseEntity<ApiResponse<GroupeClientResponse>> update(
            @PathVariable Long id,
            @Valid @RequestBody UpsertGroupeClientRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                groupeClientService.update(TenantContext.getCurrentAgence(), id, request),
                "Groupe client enregistre"
        ));
    }
}
