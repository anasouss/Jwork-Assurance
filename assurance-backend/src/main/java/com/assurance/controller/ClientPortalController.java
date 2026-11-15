package com.assurance.controller;

import com.assurance.dto.response.*;
import com.assurance.service.ClientPortalReadService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.nio.charset.StandardCharsets;

@RestController
@RequestMapping("/api/v1/client-portal")
@PreAuthorize("hasAuthority('CLIENT_PORTAL')")
@RequiredArgsConstructor
public class ClientPortalController {
    private final ClientPortalReadService service;

    @GetMapping("/dashboard")
    public ApiResponse<ClientPortalResponses.Dashboard> dashboard() {
        return ApiResponse.success(service.dashboard());
    }

    @GetMapping("/contracts")
    public ApiResponse<PagedResponse<ClientPortalResponses.Contract>> contracts(
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "25") int size) {
        return ApiResponse.success(service.contracts(page, size));
    }

    @GetMapping("/contracts/{id}")
    public ApiResponse<ClientPortalResponses.ContractDetail> contract(@PathVariable Long id,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "25") int size) {
        return ApiResponse.success(service.contract(id, page, size));
    }

    @GetMapping("/claims")
    public ApiResponse<PagedResponse<ClientPortalResponses.Claim>> claims(
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "25") int size) {
        return ApiResponse.success(service.claims(page, size));
    }

    @GetMapping("/contracts/{id}/coverages")
    public ApiResponse<PagedResponse<ClientPortalResponses.Coverage>> coverages(@PathVariable Long id,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "25") int size) {
        return ApiResponse.success(service.coverages(id, page, size));
    }

    @GetMapping("/contracts/{id}/assistances")
    public ApiResponse<PagedResponse<ClientPortalResponses.Assistance>> assistances(@PathVariable Long id,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "25") int size) {
        return ApiResponse.success(service.assistances(id, page, size));
    }

    @GetMapping("/claims/{id}")
    public ApiResponse<ClientPortalResponses.Claim> claim(@PathVariable Long id) {
        return ApiResponse.success(service.claim(id));
    }

    @GetMapping("/claims/{id}/updates")
    public ApiResponse<PagedResponse<ClientPortalResponses.Update>> updates(@PathVariable Long id,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "25") int size) {
        return ApiResponse.success(service.updates(id, page, size));
    }

    @GetMapping("/documents")
    public ApiResponse<PagedResponse<ClientPortalResponses.Document>> documents(
            @RequestParam(required = false) Long contratId,
            @RequestParam(required = false) Long sinistreId,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "25") int size) {
        return ApiResponse.success(service.documents(contratId, sinistreId, page, size));
    }

    @GetMapping("/documents/{id}/download")
    public ResponseEntity<Resource> download(@PathVariable Long id) {
        var file = service.download(id);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).contentType(file.mediaType())
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(file.fileName(), StandardCharsets.UTF_8).build().toString())
                .header("X-Content-Type-Options", "nosniff").body(file.resource());
    }
}
