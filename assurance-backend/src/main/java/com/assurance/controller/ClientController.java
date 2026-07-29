package com.assurance.controller;

import com.assurance.dto.request.CreateClientRequest;
import com.assurance.dto.request.AssignGroupeClientRequest;
import com.assurance.dto.response.ApiResponse;
import com.assurance.dto.response.ClientCrmResponse;
import com.assurance.dto.response.ClientPageResponse;
import com.assurance.dto.response.ClientResponse;
import com.assurance.security.TenantContext;
import com.assurance.service.ClientCrmService;
import com.assurance.service.ClientService;
import com.assurance.service.GroupeClientService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/clients")
@RequiredArgsConstructor
public class ClientController {

    private final ClientService clientService;
    private final ClientCrmService clientCrmService;
    private final GroupeClientService groupeClientService;

    @GetMapping
    public ResponseEntity<ApiResponse<ClientPageResponse>> list(
            @RequestParam(required = false) String query,
            @RequestParam(required = false) Long groupeId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                clientCrmService.search(TenantContext.getCurrentAgence(), query, groupeId, page, size)
        ));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ClientCrmResponse>> get(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(
                clientCrmService.get(TenantContext.getCurrentAgence(), id)
        ));
    }

    @GetMapping("/search")
    public ResponseEntity<ApiResponse<ClientResponse>> search(
            @RequestParam(required = false) String cin,
            @RequestParam(required = false) String rc
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                clientService.searchByIdentity(TenantContext.getCurrentAgence(), cin, rc).orElse(null)
        ));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<ClientResponse>> create(@Valid @RequestBody CreateClientRequest request) {
        request.setAgenceId(TenantContext.getCurrentAgence());
        return ResponseEntity.ok(ApiResponse.success(clientService.create(request), "Client créé"));
    }

    @PutMapping("/{id}/groupe")
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
    public ResponseEntity<ApiResponse<Void>> endGroupMembership(
            @PathVariable Long id,
            @PathVariable Long membershipId
    ) {
        groupeClientService.endMembership(TenantContext.getCurrentAgence(), id, membershipId);
        return ResponseEntity.ok(ApiResponse.success(null, "Rattachement groupe termine"));
    }
}
