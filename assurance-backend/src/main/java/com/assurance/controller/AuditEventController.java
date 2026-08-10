package com.assurance.controller;

import com.assurance.dto.response.ApiResponse;
import com.assurance.dto.response.AuditEventResponse;
import com.assurance.dto.response.PagedResponse;
import com.assurance.enums.AuditAction;
import com.assurance.security.TenantContext;
import com.assurance.service.AuditEventService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;

@RestController
@RequestMapping("/api/v1/audit-events")
@RequiredArgsConstructor
public class AuditEventController {

    private final AuditEventService auditEventService;

    @GetMapping
    @PreAuthorize("hasAuthority('PERM_audit:view')")
    public ResponseEntity<ApiResponse<PagedResponse<AuditEventResponse>>> search(
            @RequestParam(required = false) String entityType,
            @RequestParam(required = false) String entityId,
            @RequestParam(required = false) AuditAction action,
            @RequestParam(required = false) Long actorUserId,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime dateFrom,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime dateTo,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size
    ) {
        return ResponseEntity.ok(ApiResponse.success(auditEventService.search(
                TenantContext.getCurrentAgence(),
                entityType,
                entityId,
                action,
                actorUserId,
                dateFrom,
                dateTo,
                search,
                page,
                size
        )));
    }
}
