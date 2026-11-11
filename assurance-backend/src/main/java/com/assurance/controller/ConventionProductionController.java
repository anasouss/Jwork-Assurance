package com.assurance.controller;

import com.assurance.security.TenantContext;
import com.assurance.dto.request.ConventionProductionFilter;
import com.assurance.dto.response.ApiResponse;
import com.assurance.dto.response.ConventionProductionResponse;
import com.assurance.service.ConventionProductionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/compta/conventions/production")
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('PERM_quittance:view')")
public class ConventionProductionController {
    private final ConventionProductionService service;

    @GetMapping
    public ResponseEntity<ApiResponse<ConventionProductionResponse>> search(@ModelAttribute ConventionProductionFilter filter,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "25") int size) {
        return ResponseEntity.ok(ApiResponse.success(service.search(TenantContext.getCurrentAgence(), filter, page, size)));
    }

    @GetMapping("/export")
    public ResponseEntity<byte[]> export(@ModelAttribute ConventionProductionFilter filter) {
        return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=production-conventions.xlsx")
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(service.export(TenantContext.getCurrentAgence(), filter));
    }
}
