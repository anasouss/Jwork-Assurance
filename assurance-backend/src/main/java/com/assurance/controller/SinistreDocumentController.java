package com.assurance.controller;

import com.assurance.dto.response.ApiResponse;
import com.assurance.dto.response.SinistreDetailResponse;
import com.assurance.enums.StatutDocumentSinistre;
import com.assurance.enums.TypeDocumentSinistre;
import com.assurance.security.TenantContext;
import com.assurance.service.SinistreDocumentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.core.io.Resource;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/sinistres/{sinistreId}/documents")
@RequiredArgsConstructor
public class SinistreDocumentController {

    private final SinistreDocumentService documentService;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('PERM_sinistre:manage')")
    public ResponseEntity<ApiResponse<SinistreDetailResponse>> upload(
            @PathVariable Long sinistreId,
            @RequestParam TypeDocumentSinistre type,
            @RequestParam(required = false) String commentaire,
            @RequestParam("file") MultipartFile file
    ) {
        return ResponseEntity.ok(ApiResponse.success(documentService.upload(
                TenantContext.getCurrentAgence(),
                TenantContext.getCurrentUser(),
                sinistreId,
                type,
                commentaire,
                file
        ), "Document ajouté"));
    }

    @GetMapping("/{documentId}/download")
    @PreAuthorize("hasAnyAuthority('PERM_sinistre:view', 'PERM_sinistre:manage')")
    public ResponseEntity<Resource> download(
            @PathVariable Long sinistreId,
            @PathVariable Long documentId
    ) {
        SinistreDocumentService.DownloadedDocument download = documentService.download(
                TenantContext.getCurrentAgence(),
                sinistreId,
                documentId
        );
        return ResponseEntity.ok()
                .contentType(download.mediaType())
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(download.document().getNomFichier())
                        .build()
                        .toString())
                .body(download.resource());
    }

    @PutMapping("/{documentId}/statut")
    @PreAuthorize("hasAuthority('PERM_sinistre:manage')")
    public ResponseEntity<ApiResponse<SinistreDetailResponse>> review(
            @PathVariable Long sinistreId,
            @PathVariable Long documentId,
            @RequestParam StatutDocumentSinistre statut,
            @RequestParam(required = false) String commentaire
    ) {
        return ResponseEntity.ok(ApiResponse.success(documentService.review(
                TenantContext.getCurrentAgence(),
                TenantContext.getCurrentUser(),
                sinistreId,
                documentId,
                statut,
                commentaire
        ), "Document contrôlé"));
    }

    @DeleteMapping("/{documentId}")
    @PreAuthorize("hasAuthority('PERM_sinistre:manage')")
    public ResponseEntity<ApiResponse<SinistreDetailResponse>> delete(
            @PathVariable Long sinistreId,
            @PathVariable Long documentId
    ) {
        return ResponseEntity.ok(ApiResponse.success(documentService.delete(
                TenantContext.getCurrentAgence(),
                TenantContext.getCurrentUser(),
                sinistreId,
                documentId
        ), "Document supprimé"));
    }
}
