package com.assurance.controller;

import com.assurance.dto.response.ApiResponse;
import com.assurance.dto.response.ElementFacturableResponse;
import com.assurance.security.TenantContext;
import com.assurance.service.ElementFacturableService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/compta")
@RequiredArgsConstructor
public class ComptaController {

    private final ElementFacturableService elementFacturableService;

    @GetMapping("/elements-facturables")
    public ResponseEntity<ApiResponse<List<ElementFacturableResponse>>> elementsFacturables() {
        return ResponseEntity.ok(ApiResponse.success(elementFacturableService.list(TenantContext.getCurrentAgence())));
    }
}
