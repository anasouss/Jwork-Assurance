package com.assurance.controller;

import com.assurance.dto.response.ApiResponse;
import com.assurance.dto.response.SinistreAssistanceResponse;
import com.assurance.security.TenantContext;
import com.assurance.service.SinistreAssistanceService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/v1/sinistres/assistances")
@RequiredArgsConstructor
public class SinistreAssistanceController {
    private final SinistreAssistanceService service;

    @GetMapping
    @PreAuthorize("hasAnyAuthority('PERM_sinistre:create', 'PERM_sinistre:view', 'PERM_sinistre:manage')")
    public ApiResponse<List<SinistreAssistanceResponse>> available(@RequestParam Long contratId,
            @RequestParam(required = false) Long vehiculeId, @RequestParam LocalDate dateSinistre) {
        return ApiResponse.success(service.available(TenantContext.getCurrentAgence(), contratId, vehiculeId, dateSinistre));
    }
}
