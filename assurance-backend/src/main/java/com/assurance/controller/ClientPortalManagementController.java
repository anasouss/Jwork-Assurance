package com.assurance.controller;

import com.assurance.dto.request.ClientPortalRequests;
import com.assurance.dto.response.*;
import com.assurance.service.ClientPortalManagementService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/client-accounts")
@RequiredArgsConstructor
public class ClientPortalManagementController {
    private final ClientPortalManagementService service;

    @GetMapping("/availability")
    @PreAuthorize("hasAnyAuthority('PERM_client:view', 'PERM_client-portal-account:view')")
    public ApiResponse<Availability> availability() {
        return ApiResponse.success(new Availability(service.enabled()));
    }

    @GetMapping("/for-client/{clientId}")
    @PreAuthorize("hasAuthority('PERM_client-portal-account:view')")
    public ApiResponse<ClientPortalResponses.Account> forClient(@PathVariable Long clientId) {
        return ApiResponse.success(service.accountForClient(clientId));
    }

    public record Availability(boolean enabled) {
    }

    @GetMapping
    @PreAuthorize("hasAuthority('PERM_client-portal-account:view')")
    public ApiResponse<PagedResponse<ClientPortalResponses.Account>> accounts(
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "25") int size) {
        return ApiResponse.success(service.accounts(page, size));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('PERM_client-portal-account:create')")
    public ApiResponse<ClientPortalResponses.Account> create(@Valid @RequestBody ClientPortalRequests.CreateAccount request) {
        return ApiResponse.success(service.create(request));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('PERM_client-portal-account:view')")
    public ApiResponse<ClientPortalResponses.Account> account(@PathVariable Long id) {
        return ApiResponse.success(service.account(id));
    }

    @PutMapping("/{id}/active")
    @PreAuthorize("hasAuthority('PERM_client-portal-account:deactivate')")
    public ApiResponse<Void> active(@PathVariable Long id, @Valid @RequestBody ClientPortalRequests.Active request) {
        service.setActive(id, request.actif());
        return ApiResponse.success(null);
    }

    @PostMapping("/{id}/password")
    @PreAuthorize("hasAuthority('PERM_client-portal-account:reset-password')")
    public ApiResponse<Void> resetPassword(@PathVariable Long id, @Valid @RequestBody ClientPortalRequests.Password request) {
        service.resetPassword(id, request.password());
        return ApiResponse.success(null);
    }

    @GetMapping("/{id}/access")
    @PreAuthorize("hasAuthority('PERM_client-portal-account:view')")
    public ApiResponse<PagedResponse<ClientPortalResponses.Access>> access(@PathVariable Long id,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "25") int size) {
        return ApiResponse.success(service.accesses(id, page, size));
    }

    @PostMapping("/{id}/access")
    @PreAuthorize("hasAuthority('PERM_client-portal-account:assign')")
    public ApiResponse<ClientPortalResponses.Access> grant(@PathVariable Long id,
            @Valid @RequestBody ClientPortalRequests.Grant request) {
        return ApiResponse.success(service.grant(id, request));
    }

    @GetMapping("/{id}/candidates")
    @PreAuthorize("hasAuthority('PERM_client-portal-account:assign')")
    public ApiResponse<PagedResponse<ClientPortalResponses.Candidate>> candidates(@PathVariable Long id,
            @RequestParam(defaultValue = "false") boolean claim, @RequestParam(defaultValue = "") String query,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "25") int size) {
        return ApiResponse.success(service.candidates(id, claim, query, page, size));
    }

    @GetMapping("/access/{id}/sources")
    @PreAuthorize("hasAnyAuthority('PERM_client-portal-publication:create', 'PERM_client-portal-publication:view')")
    public ApiResponse<PagedResponse<ClientPortalResponses.Source>> sources(@PathVariable Long id,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "25") int size) {
        return ApiResponse.success(service.sources(id, page, size));
    }

    @DeleteMapping("/access/{id}")
    @PreAuthorize("hasAuthority('PERM_client-portal-account:assign')")
    public ApiResponse<Void> revoke(@PathVariable Long id) {
        service.revokeAccess(id);
        return ApiResponse.success(null);
    }

    @PostMapping("/access/{id}/documents")
    @PreAuthorize("hasAuthority('PERM_client-portal-publication:create')")
    public ApiResponse<ClientPortalResponses.Document> document(@PathVariable Long id,
            @Valid @RequestBody ClientPortalRequests.PublishDocument request) {
        return ApiResponse.success(service.publishDocument(id, request));
    }

    @GetMapping("/access/{id}/documents")
    @PreAuthorize("hasAuthority('PERM_client-portal-publication:view')")
    public ApiResponse<PagedResponse<ClientPortalResponses.StaffPublication>> documents(@PathVariable Long id,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "25") int size) {
        return ApiResponse.success(service.publications(id, false, page, size));
    }

    @GetMapping("/access/{id}/updates")
    @PreAuthorize("hasAuthority('PERM_client-portal-publication:view')")
    public ApiResponse<PagedResponse<ClientPortalResponses.StaffPublication>> updates(@PathVariable Long id,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "25") int size) {
        return ApiResponse.success(service.publications(id, true, page, size));
    }

    @DeleteMapping("/documents/{id}")
    @PreAuthorize("hasAuthority('PERM_client-portal-publication:deactivate')")
    public ApiResponse<Void> withdrawDocument(@PathVariable Long id) {
        service.withdrawDocument(id);
        return ApiResponse.success(null);
    }

    @PostMapping("/access/{id}/updates")
    @PreAuthorize("hasAuthority('PERM_client-portal-publication:create')")
    public ApiResponse<ClientPortalResponses.Update> update(@PathVariable Long id,
            @Valid @RequestBody ClientPortalRequests.PublishUpdate request) {
        return ApiResponse.success(service.publishUpdate(id, request));
    }

    @DeleteMapping("/updates/{id}")
    @PreAuthorize("hasAuthority('PERM_client-portal-publication:deactivate')")
    public ApiResponse<Void> withdrawUpdate(@PathVariable Long id) {
        service.withdrawUpdate(id);
        return ApiResponse.success(null);
    }
}
