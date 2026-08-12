package com.assurance.controller;

import com.assurance.dto.request.AcquisitionClientRequest;
import com.assurance.dto.request.AssignGroupeClientRequest;
import com.assurance.dto.request.CreateClientRequest;
import com.assurance.dto.request.UpsertOrigineCommercialeRequest;
import com.assurance.dto.response.AcquisitionClientResponse;
import com.assurance.dto.response.AcquisitionOptionsResponse;
import com.assurance.dto.response.ApiResponse;
import com.assurance.dto.response.ClientCrmResponse;
import com.assurance.dto.response.ClientPageResponse;
import com.assurance.dto.response.ClientResponse;
import com.assurance.dto.response.OrigineCommercialeResponse;
import com.assurance.security.TenantContext;
import com.assurance.service.AcquisitionClientService;
import com.assurance.service.ClientCrmService;
import com.assurance.service.ClientService;
import com.assurance.service.GroupeClientService;
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
@RequestMapping("/api/v1/clients")
@RequiredArgsConstructor
public class ClientController {

    private final ClientService clientService;
    private final ClientCrmService clientCrmService;
    private final GroupeClientService groupeClientService;
    private final AcquisitionClientService acquisitionClientService;

    @GetMapping("/acquisition/options")
    @PreAuthorize("hasAnyAuthority('PERM_client:view', 'PERM_client:create', 'PERM_contrat:create', 'PERM_contrat:update')")
    public ResponseEntity<ApiResponse<AcquisitionOptionsResponse>> acquisitionOptions() {
        return ResponseEntity.ok(ApiResponse.success(
                acquisitionClientService.options(TenantContext.getCurrentAgence())
        ));
    }

    @GetMapping("/origines-commerciales")
    @PreAuthorize("hasAuthority('PERM_client:view')")
    public ResponseEntity<ApiResponse<List<OrigineCommercialeResponse>>> listOrigins() {
        return ResponseEntity.ok(ApiResponse.success(
                acquisitionClientService.listOrigins(TenantContext.getCurrentAgence())
        ));
    }

    @PostMapping("/origines-commerciales")
    @PreAuthorize("hasAuthority('PERM_client:manage')")
    public ResponseEntity<ApiResponse<OrigineCommercialeResponse>> createOrigin(
            @Valid @RequestBody UpsertOrigineCommercialeRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                acquisitionClientService.createOrigin(TenantContext.getCurrentAgence(), request),
                "Origine commerciale créée"
        ));
    }

    @PutMapping("/origines-commerciales/{originId}")
    @PreAuthorize("hasAuthority('PERM_client:manage')")
    public ResponseEntity<ApiResponse<OrigineCommercialeResponse>> updateOrigin(
            @PathVariable Long originId,
            @Valid @RequestBody UpsertOrigineCommercialeRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                acquisitionClientService.updateOrigin(TenantContext.getCurrentAgence(), originId, request),
                "Origine commerciale mise à jour"
        ));
    }

    @PutMapping("/{id}/acquisition")
    @PreAuthorize("hasAuthority('PERM_client:manage')")
    public ResponseEntity<ApiResponse<AcquisitionClientResponse>> updateAcquisition(
            @PathVariable Long id,
            @Valid @RequestBody AcquisitionClientRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                acquisitionClientService.upsert(
                        TenantContext.getCurrentAgence(),
                        id,
                        request,
                        TenantContext.getCurrentUser()
                ),
                "Origine du client mise à jour"
        ));
    }

    @GetMapping
    @PreAuthorize("hasAnyAuthority('PERM_client:view', 'PERM_contrat:create', 'PERM_contrat:update')")
    public ResponseEntity<ApiResponse<ClientPageResponse>> list(
            @RequestParam(required = false) String query,
            @RequestParam(required = false) Long groupeId,
            @RequestParam(required = false) Long origineCommercialeId,
            @RequestParam(required = false) Long collaborateurId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                clientCrmService.search(
                        TenantContext.getCurrentAgence(),
                        query,
                        groupeId,
                        origineCommercialeId,
                        collaborateurId,
                        page,
                        size
                )
        ));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('PERM_client:view')")
    public ResponseEntity<ApiResponse<ClientCrmResponse>> get(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(
                clientCrmService.get(TenantContext.getCurrentAgence(), id)
        ));
    }

    @GetMapping("/search")
    @PreAuthorize("hasAnyAuthority('PERM_client:view', 'PERM_contrat:create', 'PERM_contrat:update')")
    public ResponseEntity<ApiResponse<ClientResponse>> search(
            @RequestParam(required = false) String cin,
            @RequestParam(required = false) String rc
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                clientService.searchByIdentity(TenantContext.getCurrentAgence(), cin, rc).orElse(null)
        ));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('PERM_client:create')")
    public ResponseEntity<ApiResponse<ClientResponse>> create(@Valid @RequestBody CreateClientRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                clientService.create(TenantContext.getCurrentAgence(), request),
                "Client créé"
        ));
    }

    @PutMapping("/{id}/groupe")
    @PreAuthorize("hasAnyAuthority('PERM_client:manage', 'PERM_client:create')")
    public ResponseEntity<ApiResponse<ClientResponse.GroupeView>> assignGroup(
            @PathVariable Long id,
            @Valid @RequestBody AssignGroupeClientRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                groupeClientService.assign(TenantContext.getCurrentAgence(), id, request),
                "Rattachement groupe enregistre"
        ));
    }

    @DeleteMapping("/{id}/groupes/{membershipId}")
    @PreAuthorize("hasAnyAuthority('PERM_client:manage', 'PERM_client:create')")
    public ResponseEntity<ApiResponse<Void>> endGroupMembership(
            @PathVariable Long id,
            @PathVariable Long membershipId
    ) {
        groupeClientService.endMembership(TenantContext.getCurrentAgence(), id, membershipId);
        return ResponseEntity.ok(ApiResponse.success(null, "Rattachement groupe termine"));
    }
}
