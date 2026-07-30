package com.assurance.controller;

import com.assurance.dto.response.ApiResponse;
import com.assurance.dto.response.DashboardResponse;
import com.assurance.exception.BadRequestException;
import com.assurance.security.TenantContext;
import com.assurance.service.DashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/v1/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;

    @GetMapping
    public ResponseEntity<ApiResponse<DashboardResponse>> dashboard(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateDu,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateAu
    ) {
        if (dateDu.isAfter(dateAu)) {
            throw new BadRequestException("La date de début doit précéder la date de fin");
        }
        if (dateDu.plusYears(2).isBefore(dateAu)) {
            throw new BadRequestException("La période du tableau de bord ne peut pas dépasser deux ans");
        }
        return ResponseEntity.ok(ApiResponse.success(
                dashboardService.get(TenantContext.getCurrentAgence(), dateDu, dateAu)
        ));
    }
}
