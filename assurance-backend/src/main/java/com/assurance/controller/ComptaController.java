package com.assurance.controller;

import com.assurance.dto.request.CreerDocumentClientRequest;
import com.assurance.dto.request.AnnulerDocumentClientRequest;
import com.assurance.dto.request.EnregistrerAffectationQuittanceRequest;
import com.assurance.dto.request.UpsertRegleAffectationQuittanceRequest;
import com.assurance.dto.response.AffectationQuittancePageResponse;
import com.assurance.dto.response.AffectationQuittanceResponse;
import com.assurance.dto.response.ApiResponse;
import com.assurance.dto.response.DocumentClientPageResponse;
import com.assurance.dto.response.DocumentClientResponse;
import com.assurance.dto.response.ElementFacturableResponse;
import com.assurance.dto.response.ImportAffectationQuittancePreviewResponse;
import com.assurance.dto.response.RegleAffectationQuittancePageResponse;
import com.assurance.dto.response.RegleAffectationQuittanceResponse;
import com.assurance.dto.response.SourceDocumentClientPageResponse;
import com.assurance.enums.StatutDocumentClient;
import com.assurance.enums.TypeContrat;
import com.assurance.enums.TypeDocumentClient;
import com.assurance.security.TenantContext;
import com.assurance.service.AffectationQuittanceService;
import com.assurance.service.DocumentClientPdfService;
import com.assurance.service.DocumentClientService;
import com.assurance.service.ElementFacturableService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/v1/compta")
@RequiredArgsConstructor
public class ComptaController {

    private final ElementFacturableService elementFacturableService;
    private final AffectationQuittanceService affectationQuittanceService;
    private final DocumentClientService documentClientService;
    private final DocumentClientPdfService documentClientPdfService;

    @GetMapping("/elements-facturables")
    @PreAuthorize("hasAuthority('PERM_quittance:view')")
    public ResponseEntity<ApiResponse<List<ElementFacturableResponse>>> elementsFacturables() {
        return ResponseEntity.ok(ApiResponse.success(elementFacturableService.list(TenantContext.getCurrentAgence())));
    }

    @GetMapping("/quittances")
    @PreAuthorize("hasAuthority('PERM_quittance:view')")
    public ResponseEntity<ApiResponse<AffectationQuittancePageResponse>> quittances(
            @RequestParam(required = false) Long compagnieId,
            @RequestParam(required = false) TypeContrat typeContrat,
            @RequestParam(required = false) Boolean avecQuittance,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateDu,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateAu,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size
    ) {
        return ResponseEntity.ok(ApiResponse.success(affectationQuittanceService.search(
                TenantContext.getCurrentAgence(),
                compagnieId,
                typeContrat,
                avecQuittance,
                dateDu,
                dateAu,
                search,
                page,
                size
        )));
    }

    @GetMapping("/quittances/{quittanceId}/affectation")
    @PreAuthorize("hasAuthority('PERM_quittance:view')")
    public ResponseEntity<ApiResponse<AffectationQuittanceResponse>> affectation(
            @PathVariable Long quittanceId,
            @RequestParam(required = false) Boolean avecRetenue
    ) {
        return ResponseEntity.ok(ApiResponse.success(affectationQuittanceService.detail(
                TenantContext.getCurrentAgence(),
                quittanceId,
                avecRetenue
        )));
    }

    @PutMapping("/quittances/{quittanceId}/affectation")
    @PreAuthorize("hasAnyAuthority('PERM_quittance:create', 'PERM_quittance:manage')")
    public ResponseEntity<ApiResponse<AffectationQuittanceResponse>> enregistrerAffectation(
            @PathVariable Long quittanceId,
            @Valid @RequestBody EnregistrerAffectationQuittanceRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                affectationQuittanceService.save(
                        TenantContext.getCurrentAgence(),
                        TenantContext.getCurrentUser(),
                        quittanceId,
                        request
                ),
                "Affectation de la quittance enregistrée"
        ));
    }

    @DeleteMapping("/quittances/{quittanceId}/affectation")
    @PreAuthorize("hasAnyAuthority('PERM_quittance:create', 'PERM_quittance:manage')")
    public ResponseEntity<ApiResponse<Void>> supprimerAffectation(@PathVariable Long quittanceId) {
        affectationQuittanceService.clear(TenantContext.getCurrentAgence(), quittanceId);
        return ResponseEntity.ok(ApiResponse.success(null, "Affectation supprimée"));
    }

    @PostMapping("/quittances/{quittanceId}/imports/previsualisation")
    @PreAuthorize("hasAnyAuthority('PERM_quittance:create', 'PERM_quittance:manage')")
    public ResponseEntity<ApiResponse<ImportAffectationQuittancePreviewResponse>> previsualiserImport(
            @PathVariable Long quittanceId,
            @RequestParam boolean avecRetenue,
            @RequestParam("file") MultipartFile file
    ) {
        return ResponseEntity.ok(ApiResponse.success(affectationQuittanceService.previewImport(
                TenantContext.getCurrentAgence(),
                quittanceId,
                avecRetenue,
                file
        )));
    }

    @GetMapping("/regles-quittances")
    @PreAuthorize("hasAuthority('PERM_quittance:view')")
    public ResponseEntity<ApiResponse<RegleAffectationQuittancePageResponse>> reglesQuittances(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                affectationQuittanceService.listRules(TenantContext.getCurrentAgence(), page, size)
        ));
    }

    @PostMapping("/regles-quittances")
    @PreAuthorize("hasAnyAuthority('PERM_quittance:manage', 'PERM_config:manage')")
    public ResponseEntity<ApiResponse<RegleAffectationQuittanceResponse>> creerRegleQuittance(
            @Valid @RequestBody UpsertRegleAffectationQuittanceRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                affectationQuittanceService.createRule(TenantContext.getCurrentAgence(), request),
                "Règle d'affectation créée"
        ));
    }

    @PutMapping("/regles-quittances/{ruleId}")
    @PreAuthorize("hasAnyAuthority('PERM_quittance:manage', 'PERM_config:manage')")
    public ResponseEntity<ApiResponse<RegleAffectationQuittanceResponse>> modifierRegleQuittance(
            @PathVariable Long ruleId,
            @Valid @RequestBody UpsertRegleAffectationQuittanceRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                affectationQuittanceService.updateRule(TenantContext.getCurrentAgence(), ruleId, request),
                "Règle d'affectation modifiée"
        ));
    }

    @DeleteMapping("/regles-quittances/{ruleId}")
    @PreAuthorize("hasAnyAuthority('PERM_quittance:manage', 'PERM_config:manage')")
    public ResponseEntity<ApiResponse<Void>> supprimerRegleQuittance(@PathVariable Long ruleId) {
        affectationQuittanceService.deleteRule(TenantContext.getCurrentAgence(), ruleId);
        return ResponseEntity.ok(ApiResponse.success(null, "Règle d'affectation supprimée"));
    }

    @GetMapping("/documents-clients/sources")
    @PreAuthorize("hasAuthority('PERM_quittance:view')")
    public ResponseEntity<ApiResponse<SourceDocumentClientPageResponse>> sourcesDocumentsClients(
            @RequestParam String payeurType,
            @RequestParam Long payeurId,
            @RequestParam(required = false) TypeContrat typeContrat,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateDu,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateAu,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size
    ) {
        return ResponseEntity.ok(ApiResponse.success(documentClientService.searchSources(
                TenantContext.getCurrentAgence(),
                payeurType,
                payeurId,
                typeContrat,
                dateDu,
                dateAu,
                search,
                page,
                size
        )));
    }

    @GetMapping("/documents-clients")
    @PreAuthorize("hasAuthority('PERM_quittance:view')")
    public ResponseEntity<ApiResponse<DocumentClientPageResponse>> documentsClients(
            @RequestParam String payeurType,
            @RequestParam Long payeurId,
            @RequestParam(required = false) TypeDocumentClient type,
            @RequestParam(required = false) StatutDocumentClient statut,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateDu,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateAu,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size
    ) {
        return ResponseEntity.ok(ApiResponse.success(documentClientService.searchDocuments(
                TenantContext.getCurrentAgence(),
                payeurType,
                payeurId,
                type,
                statut,
                dateDu,
                dateAu,
                search,
                page,
                size
        )));
    }

    @PostMapping("/documents-clients")
    @PreAuthorize("hasAnyAuthority('PERM_quittance:create', 'PERM_quittance:manage')")
    public ResponseEntity<ApiResponse<DocumentClientResponse>> creerDocumentClient(
            @Valid @RequestBody CreerDocumentClientRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                documentClientService.create(TenantContext.getCurrentAgence(), request),
                request.getTypeDocument() == TypeDocumentClient.RELEVE
                        ? "Relevé émis"
                        : "Facture émise"
        ));
    }

    @GetMapping("/documents-clients/{documentId}")
    @PreAuthorize("hasAuthority('PERM_quittance:view')")
    public ResponseEntity<ApiResponse<DocumentClientResponse>> documentClient(@PathVariable Long documentId) {
        return ResponseEntity.ok(ApiResponse.success(
                documentClientService.detail(TenantContext.getCurrentAgence(), documentId)
        ));
    }

    @PostMapping("/documents-clients/{documentId}/annulation")
    @PreAuthorize("hasAnyAuthority('PERM_quittance:create', 'PERM_quittance:manage')")
    public ResponseEntity<ApiResponse<DocumentClientResponse>> annulerDocumentClient(
            @PathVariable Long documentId,
            @Valid @RequestBody AnnulerDocumentClientRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                documentClientService.cancel(TenantContext.getCurrentAgence(), documentId, request),
                "Document annulé"
        ));
    }

    @GetMapping("/documents-clients/{documentId}/pdf")
    @PreAuthorize("hasAuthority('PERM_quittance:view')")
    public ResponseEntity<byte[]> documentClientPdf(@PathVariable Long documentId) {
        DocumentClientResponse detail = documentClientService.detail(TenantContext.getCurrentAgence(), documentId);
        byte[] pdf = documentClientPdfService.generate(TenantContext.getCurrentAgence(), documentId);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=" + detail.getNumero() + ".pdf")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }
}
