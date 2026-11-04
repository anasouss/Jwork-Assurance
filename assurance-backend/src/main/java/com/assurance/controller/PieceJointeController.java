package com.assurance.controller;

import com.assurance.dto.request.UpsertTypePieceJointeRequest;
import com.assurance.dto.response.ApiResponse;
import com.assurance.dto.response.PieceJointeResponse;
import com.assurance.dto.response.PiecesJointesContratResponse;
import com.assurance.dto.response.ReferenceOptionResponse;
import com.assurance.dto.response.TypePieceJointeResponse;
import com.assurance.security.TenantContext;
import com.assurance.service.PieceJointeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class PieceJointeController {

    private final PieceJointeService pieceJointeService;

    @GetMapping("/api/v1/pieces-jointes/types")
    @PreAuthorize("hasAnyAuthority('PERM_piece-jointe:view', 'PERM_contrat:view')")
    public ResponseEntity<ApiResponse<List<TypePieceJointeResponse>>> listTypes(
            @RequestParam(defaultValue = "false") boolean includeInactive
    ) {
        return ResponseEntity.ok(ApiResponse.success(pieceJointeService.listTypes(TenantContext.getCurrentAgence(), includeInactive)));
    }

    @PostMapping("/api/v1/pieces-jointes/types")
    @PreAuthorize("hasAnyAuthority('PERM_piece-jointe:manage', 'PERM_config:manage')")
    public ResponseEntity<ApiResponse<TypePieceJointeResponse>> createType(@Valid @org.springframework.web.bind.annotation.RequestBody UpsertTypePieceJointeRequest request) {
        return ResponseEntity.ok(ApiResponse.success(pieceJointeService.upsertType(TenantContext.getCurrentAgence(), null, request), "Type de piece jointe enregistre"));
    }

    @PutMapping("/api/v1/pieces-jointes/types/{id}")
    @PreAuthorize("hasAnyAuthority('PERM_piece-jointe:manage', 'PERM_config:manage')")
    public ResponseEntity<ApiResponse<TypePieceJointeResponse>> updateType(
            @PathVariable Long id,
            @Valid @org.springframework.web.bind.annotation.RequestBody UpsertTypePieceJointeRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(pieceJointeService.upsertType(TenantContext.getCurrentAgence(), id, request), "Type de piece jointe enregistre"));
    }

    @DeleteMapping("/api/v1/pieces-jointes/types/{id}")
    @PreAuthorize("hasAnyAuthority('PERM_piece-jointe:manage', 'PERM_config:manage')")
    public ResponseEntity<ApiResponse<Void>> deactivateType(@PathVariable Long id) {
        pieceJointeService.deactivateType(TenantContext.getCurrentAgence(), id);
        return ResponseEntity.ok(ApiResponse.success(null, "Type de piece jointe desactive"));
    }

    @GetMapping("/api/v1/pieces-jointes/types-mouvements")
    @PreAuthorize("hasAnyAuthority('PERM_piece-jointe:view', 'PERM_contrat:view')")
    public ResponseEntity<ApiResponse<List<ReferenceOptionResponse>>> listTypesMouvement() {
        return ResponseEntity.ok(ApiResponse.success(pieceJointeService.listTypesMouvement()));
    }

    @GetMapping("/api/v1/contrats/{contratId}/pieces-jointes")
    @PreAuthorize("hasAnyAuthority('PERM_piece-jointe:view', 'PERM_contrat:view')")
    public ResponseEntity<ApiResponse<PiecesJointesContratResponse>> listContratPieces(
            @PathVariable Long contratId,
            @RequestParam(required = false) Long mouvementId
    ) {
        return ResponseEntity.ok(ApiResponse.success(pieceJointeService.listContratPieces(TenantContext.getCurrentAgence(), contratId, mouvementId)));
    }

    @PostMapping(path = "/api/v1/contrats/{contratId}/pieces-jointes", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyAuthority('PERM_piece-jointe:manage', 'PERM_contrat:update')")
    public ResponseEntity<ApiResponse<PieceJointeResponse>> upload(
            @PathVariable Long contratId,
            @RequestParam(required = false) Long mouvementId,
            @RequestParam(required = false) Long typePieceJointeId,
            @RequestParam(required = false) String customTypeLabel,
            @RequestParam(required = false) Long clientId,
            @RequestParam(required = false) Long vehiculeId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) java.time.LocalDate expiresOn,
            @RequestPart("files") List<MultipartFile> files
    ) {
        return ResponseEntity.ok(ApiResponse.success(pieceJointeService.uploadForOwner(
                TenantContext.getCurrentAgence(),
                contratId,
                mouvementId,
                typePieceJointeId,
                customTypeLabel,
                files, clientId, vehiculeId, expiresOn
        ), "Piece jointe enregistree"));
    }

    @PutMapping("/api/v1/pieces-jointes/natures/{natureId}/policy")
    @PreAuthorize("hasAnyAuthority('PERM_piece-jointe:manage', 'PERM_config:manage')")
    public ResponseEntity<ApiResponse<Void>> policy(@PathVariable Long natureId,
            @RequestParam com.assurance.enums.DocumentOwner owner,
            @RequestParam com.assurance.enums.DocumentExpiry expiry,
            @RequestParam(required = false) com.assurance.enums.DocumentValiditySource source) {
        pieceJointeService.updatePolicy(TenantContext.getCurrentAgence(), natureId, owner, expiry, source);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @GetMapping("/api/v1/clients/documents/types")
    @PreAuthorize("hasAnyAuthority('PERM_client:view', 'PERM_client:create', 'PERM_client:manage')")
    public ResponseEntity<ApiResponse<List<TypePieceJointeResponse>>> clientTypes(
            @RequestParam com.assurance.enums.TypeClient typeClient) {
        return ResponseEntity.ok(ApiResponse.success(pieceJointeService.clientTypes(TenantContext.getCurrentAgence(), typeClient)));
    }

    @GetMapping("/api/v1/clients/{clientId}/pieces-jointes")
    @PreAuthorize("hasAuthority('PERM_client:view')")
    public ResponseEntity<ApiResponse<List<PieceJointeResponse>>> clientDocuments(@PathVariable Long clientId) {
        return ResponseEntity.ok(ApiResponse.success(pieceJointeService.clientDocuments(TenantContext.getCurrentAgence(), clientId)));
    }

    @PostMapping(path = "/api/v1/clients/{clientId}/pieces-jointes", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyAuthority('PERM_client:manage', 'PERM_client:create')")
    public ResponseEntity<ApiResponse<PieceJointeResponse>> uploadClient(@PathVariable Long clientId,
            @RequestParam Long typePieceJointeId, @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) java.time.LocalDate expiresOn,
            @RequestParam(required = false) Long previousVersionId, @RequestParam(required = false) String reason,
            @RequestPart("files") List<MultipartFile> files) {
        return ResponseEntity.ok(ApiResponse.success(pieceJointeService.uploadClient(TenantContext.getCurrentAgence(),
                clientId, typePieceJointeId, files, expiresOn, previousVersionId, reason)));
    }

    @DeleteMapping("/api/v1/clients/{clientId}/pieces-jointes/{pieceId}")
    @PreAuthorize("hasAnyAuthority('PERM_client:manage', 'PERM_client:create')")
    public ResponseEntity<ApiResponse<Void>> deleteClient(@PathVariable Long clientId, @PathVariable Long pieceId) {
        pieceJointeService.deleteClientDocument(TenantContext.getCurrentAgence(), clientId, pieceId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @GetMapping("/api/v1/clients/{clientId}/pieces-jointes/{pieceId}/download")
    @PreAuthorize("hasAuthority('PERM_client:view')")
    public ResponseEntity<Resource> downloadClient(@PathVariable Long clientId, @PathVariable Long pieceId) {
        PieceJointeService.DownloadedPiece download = pieceJointeService.downloadClientDocument(TenantContext.getCurrentAgence(), clientId, pieceId);
        return ResponseEntity.ok().contentType(download.mediaType())
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(download.fileName(), java.nio.charset.StandardCharsets.UTF_8).build().toString())
                .body(download.resource());
    }

    @PostMapping("/api/v1/contrats/{contratId}/pieces-jointes/reuse")
    @PreAuthorize("hasAnyAuthority('PERM_piece-jointe:manage', 'PERM_contrat:update') and hasAuthority('PERM_client:view')")
    public ResponseEntity<ApiResponse<PieceJointeResponse>> reuse(@PathVariable Long contratId,
            @RequestParam Long pieceId, @RequestParam Long typePieceJointeId,
            @RequestParam(required = false) Long mouvementId) {
        return ResponseEntity.ok(ApiResponse.success(pieceJointeService.reuse(TenantContext.getCurrentAgence(),
                contratId, mouvementId, pieceId, typePieceJointeId)));
    }

    @PostMapping("/api/v1/contrats/{contratId}/pieces-jointes/{pieceId}/owner")
    @PreAuthorize("hasAnyAuthority('PERM_piece-jointe:manage', 'PERM_contrat:update')")
    public ResponseEntity<ApiResponse<PieceJointeResponse>> assignOwner(@PathVariable Long contratId, @PathVariable Long pieceId,
            @RequestParam(required = false) Long clientId, @RequestParam(required = false) Long vehiculeId) {
        return ResponseEntity.ok(ApiResponse.success(pieceJointeService.assignOwner(TenantContext.getCurrentAgence(),
                contratId, pieceId, clientId, vehiculeId)));
    }

    @DeleteMapping("/api/v1/contrats/{contratId}/pieces-jointes/{pieceId}/usage")
    @PreAuthorize("hasAnyAuthority('PERM_piece-jointe:manage', 'PERM_contrat:update')")
    public ResponseEntity<ApiResponse<Void>> unlink(@PathVariable Long contratId, @PathVariable Long pieceId,
            @RequestParam(required = false) Long mouvementId) {
        pieceJointeService.unlink(TenantContext.getCurrentAgence(), contratId, mouvementId, pieceId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PostMapping(path = "/api/v1/contrats/{contratId}/pieces-jointes/{pieceId}/replace", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyAuthority('PERM_piece-jointe:manage', 'PERM_contrat:update')")
    public ResponseEntity<ApiResponse<PieceJointeResponse>> replace(@PathVariable Long contratId, @PathVariable Long pieceId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) java.time.LocalDate expiresOn, @RequestParam String reason,
            @RequestPart("files") List<MultipartFile> files) {
        return ResponseEntity.ok(ApiResponse.success(pieceJointeService.replaceContractDocument(TenantContext.getCurrentAgence(),
                contratId, pieceId, files, expiresOn, reason)));
    }

    @GetMapping("/api/v1/contrats/{contratId}/pieces-jointes/{pieceId}/download")
    @PreAuthorize("hasAnyAuthority('PERM_piece-jointe:view', 'PERM_contrat:view')")
    public ResponseEntity<Resource> download(@PathVariable Long contratId, @PathVariable Long pieceId) {
        PieceJointeService.DownloadedPiece download = pieceJointeService.download(TenantContext.getCurrentAgence(), contratId, pieceId);
        return ResponseEntity.ok()
                .contentType(download.mediaType())
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(download.fileName(), java.nio.charset.StandardCharsets.UTF_8)
                        .build()
                        .toString())
                .body(download.resource());
    }

    @DeleteMapping("/api/v1/contrats/{contratId}/pieces-jointes/{pieceId}")
    @PreAuthorize("hasAnyAuthority('PERM_piece-jointe:manage', 'PERM_contrat:update')")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long contratId, @PathVariable Long pieceId) {
        pieceJointeService.delete(TenantContext.getCurrentAgence(), contratId, pieceId);
        return ResponseEntity.ok(ApiResponse.success(null, "Piece jointe supprimee"));
    }
}
