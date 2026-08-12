package com.assurance.controller;

import com.assurance.dto.request.ConfigurationImportReleveBancaireRequest;
import com.assurance.dto.request.EnregistrerRapprochementsBancairesRequest;
import com.assurance.dto.response.ApiResponse;
import com.assurance.dto.response.ImportReleveBancaireResponse;
import com.assurance.dto.response.PagedResponse;
import com.assurance.dto.response.ProfilImportReleveBancaireResponse;
import com.assurance.security.TenantContext;
import com.assurance.service.ReleveBancaireService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/v1/compta/tresorerie/releves-bancaires")
@RequiredArgsConstructor
public class ReleveBancaireController {

    private final ReleveBancaireService releveBancaireService;

    @PostMapping(
            value = "/previsualisation",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE
    )
    @PreAuthorize("hasAuthority('PERM_tresorerie:manage')")
    public ResponseEntity<ApiResponse<ImportReleveBancaireResponse>> preview(
            @RequestPart("file") MultipartFile file,
            @Valid @RequestPart("configuration") ConfigurationImportReleveBancaireRequest configuration
    ) {
        return ResponseEntity.ok(ApiResponse.success(releveBancaireService.preview(
                file,
                configuration
        )));
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('PERM_tresorerie:manage')")
    public ResponseEntity<ApiResponse<ImportReleveBancaireResponse>> confirmImport(
            @RequestParam Long compteId,
            @RequestParam(required = false) Long profilId,
            @RequestPart("file") MultipartFile file,
            @Valid @RequestPart("configuration") ConfigurationImportReleveBancaireRequest configuration
    ) {
        return ResponseEntity.ok(ApiResponse.success(releveBancaireService.confirmImport(
                TenantContext.getCurrentAgence(),
                compteId,
                profilId,
                file,
                configuration
        ), "Relevé bancaire importé"));
    }

    @GetMapping
    @PreAuthorize("hasAuthority('PERM_tresorerie:view')")
    public ResponseEntity<ApiResponse<PagedResponse<ImportReleveBancaireResponse>>> list(
            @RequestParam Long compteId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return ResponseEntity.ok(ApiResponse.success(releveBancaireService.list(
                TenantContext.getCurrentAgence(),
                compteId,
                page,
                size
        )));
    }

    @GetMapping("/profils")
    @PreAuthorize("hasAuthority('PERM_tresorerie:view')")
    public ResponseEntity<ApiResponse<List<ProfilImportReleveBancaireResponse>>> profiles(
            @RequestParam Long compteId
    ) {
        return ResponseEntity.ok(ApiResponse.success(releveBancaireService.profiles(
                TenantContext.getCurrentAgence(),
                compteId
        )));
    }

    @GetMapping("/{importId}")
    @PreAuthorize("hasAuthority('PERM_tresorerie:view')")
    public ResponseEntity<ApiResponse<ImportReleveBancaireResponse>> detail(
            @PathVariable Long importId
    ) {
        return ResponseEntity.ok(ApiResponse.success(releveBancaireService.detail(
                TenantContext.getCurrentAgence(),
                importId
        )));
    }

    @PutMapping("/{importId}/rapprochements")
    @PreAuthorize("hasAuthority('PERM_tresorerie:manage')")
    public ResponseEntity<ApiResponse<ImportReleveBancaireResponse>> saveReconciliations(
            @PathVariable Long importId,
            @Valid @RequestBody EnregistrerRapprochementsBancairesRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(releveBancaireService.saveReconciliations(
                TenantContext.getCurrentAgence(),
                importId,
                request
        ), "Correspondances enregistrées"));
    }

    @PostMapping("/{importId}/validation")
    @PreAuthorize("hasAuthority('PERM_tresorerie:manage')")
    public ResponseEntity<ApiResponse<ImportReleveBancaireResponse>> validate(
            @PathVariable Long importId
    ) {
        return ResponseEntity.ok(ApiResponse.success(releveBancaireService.validate(
                TenantContext.getCurrentAgence(),
                importId
        ), "Rapprochement bancaire validé"));
    }
}
