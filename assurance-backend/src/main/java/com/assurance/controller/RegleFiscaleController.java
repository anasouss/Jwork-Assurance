package com.assurance.controller;

import com.assurance.dto.request.UpsertRegleFiscaleRequest;
import com.assurance.dto.response.ApiResponse;
import com.assurance.dto.response.RegleFiscaleResponse;
import com.assurance.service.RegleFiscaleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/regles-fiscales")
@RequiredArgsConstructor
public class RegleFiscaleController {

    private final RegleFiscaleService regleFiscaleService;

    @GetMapping
    @PreAuthorize("hasAnyAuthority('PERM_regle-fiscale:view', 'PERM_regle-fiscale:manage', 'PERM_config:manage')")
    public ResponseEntity<ApiResponse<List<RegleFiscaleResponse>>> list() {
        return ResponseEntity.ok(ApiResponse.success(regleFiscaleService.list()));
    }

    @PostMapping
    @PreAuthorize("hasAnyAuthority('PERM_regle-fiscale:manage', 'PERM_config:manage')")
    public ResponseEntity<ApiResponse<RegleFiscaleResponse>> create(@Valid @RequestBody UpsertRegleFiscaleRequest request) {
        return ResponseEntity.ok(ApiResponse.success(regleFiscaleService.create(request), "Règle fiscale créée"));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('PERM_regle-fiscale:manage', 'PERM_config:manage')")
    public ResponseEntity<ApiResponse<RegleFiscaleResponse>> update(
            @PathVariable Long id,
            @Valid @RequestBody UpsertRegleFiscaleRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(regleFiscaleService.update(id, request), "Règle fiscale modifiée"));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('PERM_regle-fiscale:manage', 'PERM_config:manage')")
    public ResponseEntity<ApiResponse<Void>> deactivate(@PathVariable Long id) {
        regleFiscaleService.deactivate(id);
        return ResponseEntity.ok(ApiResponse.success(null, "Règle fiscale désactivée"));
    }
}
