package com.assurance.controller;

import com.assurance.dto.request.UpdateContactCompagnieStatusRequest;
import com.assurance.dto.request.UpsertContactCompagnieRequest;
import com.assurance.dto.response.ApiResponse;
import com.assurance.dto.response.ContactCompagnieResponse;
import com.assurance.dto.response.PagedResponse;
import com.assurance.enums.ServiceContactCompagnie;
import com.assurance.security.TenantContext;
import com.assurance.service.ContactCompagnieService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/compagnies-assurance")
@RequiredArgsConstructor
public class ContactCompagnieController {

    private final ContactCompagnieService contactService;

    @GetMapping("/contacts")
    @PreAuthorize("hasAnyAuthority('PERM_contact-compagnie:view', 'PERM_contact-compagnie:manage')")
    public ResponseEntity<ApiResponse<PagedResponse<ContactCompagnieResponse>>> list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Long compagnieId,
            @RequestParam(required = false) ServiceContactCompagnie service,
            @RequestParam(required = false) Boolean actif,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size
    ) {
        return ResponseEntity.ok(ApiResponse.success(contactService.list(
                TenantContext.getCurrentAgence(), q, compagnieId, service, actif, page, size)));
    }

    @PostMapping("/{compagnieId}/contacts")
    @PreAuthorize("hasAuthority('PERM_contact-compagnie:manage')")
    public ResponseEntity<ApiResponse<ContactCompagnieResponse>> create(
            @PathVariable Long compagnieId,
            @Valid @RequestBody UpsertContactCompagnieRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                contactService.create(TenantContext.getCurrentAgence(), compagnieId, request),
                "Contact compagnie ajouté"));
    }

    @PutMapping("/{compagnieId}/contacts/{contactId}")
    @PreAuthorize("hasAuthority('PERM_contact-compagnie:manage')")
    public ResponseEntity<ApiResponse<ContactCompagnieResponse>> update(
            @PathVariable Long compagnieId,
            @PathVariable Long contactId,
            @Valid @RequestBody UpsertContactCompagnieRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                contactService.update(TenantContext.getCurrentAgence(), compagnieId, contactId, request),
                "Contact compagnie modifié"));
    }

    @PatchMapping("/{compagnieId}/contacts/{contactId}/statut")
    @PreAuthorize("hasAuthority('PERM_contact-compagnie:manage')")
    public ResponseEntity<ApiResponse<ContactCompagnieResponse>> updateStatus(
            @PathVariable Long compagnieId,
            @PathVariable Long contactId,
            @Valid @RequestBody UpdateContactCompagnieStatusRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                contactService.updateStatus(TenantContext.getCurrentAgence(), compagnieId, contactId, request),
                Boolean.TRUE.equals(request.getActif()) ? "Contact réactivé" : "Contact désactivé"));
    }
}
