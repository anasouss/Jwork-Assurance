package com.assurance.controller;

import com.assurance.activity.ActivityAction;
import com.assurance.activity.ActivityModule;
import com.assurance.activity.ActivityRecordType;
import com.assurance.dto.response.ApiResponse;
import com.assurance.dto.response.BusinessActivityResponse;
import com.assurance.dto.response.PagedResponse;
import com.assurance.service.BusinessActivityService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;

@RestController
@RequestMapping("/api/v1/business-activities")
@RequiredArgsConstructor
public class BusinessActivityController {
    private final BusinessActivityService service;

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('PERM_activity:view')")
    public ApiResponse<BusinessActivityResponse> detail(@PathVariable Long id) {
        return ApiResponse.success(service.detail(id));
    }

    @GetMapping
    @PreAuthorize("hasAuthority('PERM_activity:view')")
    public ApiResponse<PagedResponse<BusinessActivityResponse>> search(
            @RequestParam(required = false) ActivityModule module,
            @RequestParam(required = false) ActivityAction action,
            @RequestParam(required = false) ActivityRecordType subjectType,
            @RequestParam(required = false) String subjectId,
            @RequestParam(required = false) Long actorUserId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime dateFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime dateTo,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size) {
        return ApiResponse.success(service.search(module, action, subjectType, subjectId, actorUserId,
                dateFrom, dateTo, search, page, size));
    }
}
