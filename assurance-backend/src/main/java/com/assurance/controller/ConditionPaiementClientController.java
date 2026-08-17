package com.assurance.controller;

import com.assurance.dto.response.ApiResponse;
import com.assurance.dto.response.ConditionPaiementClientResponse;
import com.assurance.enums.TypeJustificationConditionPaiement;
import com.assurance.security.TenantContext;
import com.assurance.service.ConditionPaiementClientService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/v1/conditions-paiement-clients")
@RequiredArgsConstructor
public class ConditionPaiementClientController {

    private final ConditionPaiementClientService service;

    @GetMapping
    @PreAuthorize("hasAuthority('PERM_client:view')")
    public ResponseEntity<ApiResponse<List<ConditionPaiementClientResponse>>> list(
            @RequestParam String payeurType,
            @RequestParam Long payeurId
    ) {
        return ResponseEntity.ok(ApiResponse.success(service.list(
                TenantContext.getCurrentAgence(),
                payeurType,
                payeurId
        )));
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('PERM_client:manage')")
    public ResponseEntity<ApiResponse<ConditionPaiementClientResponse>> create(
            @RequestParam String payeurType,
            @RequestParam Long payeurId,
            @RequestParam Integer delaiJours,
            @RequestParam TypeJustificationConditionPaiement typeJustification,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateDebut,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateFin,
            @RequestParam(required = false) String commentaire,
            @RequestParam(required = false) MultipartFile justificatif
    ) {
        return ResponseEntity.ok(ApiResponse.success(service.create(
                TenantContext.getCurrentAgence(),
                payeurType,
                payeurId,
                delaiJours,
                typeJustification,
                dateDebut,
                dateFin,
                commentaire,
                justificatif
        ), "Condition de paiement enregistrée"));
    }

    @GetMapping("/{conditionId}/justificatif")
    @PreAuthorize("hasAuthority('PERM_client:view')")
    public ResponseEntity<Resource> download(@PathVariable Long conditionId) {
        ConditionPaiementClientService.DownloadedFile download = service.download(
                TenantContext.getCurrentAgence(),
                conditionId
        );
        return ResponseEntity.ok()
                .contentType(download.mediaType())
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(download.fileName())
                        .build()
                        .toString())
                .body(download.resource());
    }
}
