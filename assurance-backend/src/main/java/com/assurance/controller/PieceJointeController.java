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
    public ResponseEntity<ApiResponse<List<TypePieceJointeResponse>>> listTypes(
            @RequestParam(defaultValue = "false") boolean includeInactive
    ) {
        return ResponseEntity.ok(ApiResponse.success(pieceJointeService.listTypes(TenantContext.getCurrentAgence(), includeInactive)));
    }

    @PostMapping("/api/v1/pieces-jointes/types")
    public ResponseEntity<ApiResponse<TypePieceJointeResponse>> createType(@Valid @org.springframework.web.bind.annotation.RequestBody UpsertTypePieceJointeRequest request) {
        return ResponseEntity.ok(ApiResponse.success(pieceJointeService.upsertType(TenantContext.getCurrentAgence(), null, request), "Type de piece jointe enregistre"));
    }

    @PutMapping("/api/v1/pieces-jointes/types/{id}")
    public ResponseEntity<ApiResponse<TypePieceJointeResponse>> updateType(
            @PathVariable Long id,
            @Valid @org.springframework.web.bind.annotation.RequestBody UpsertTypePieceJointeRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(pieceJointeService.upsertType(TenantContext.getCurrentAgence(), id, request), "Type de piece jointe enregistre"));
    }

    @DeleteMapping("/api/v1/pieces-jointes/types/{id}")
    public ResponseEntity<ApiResponse<Void>> deactivateType(@PathVariable Long id) {
        pieceJointeService.deactivateType(TenantContext.getCurrentAgence(), id);
        return ResponseEntity.ok(ApiResponse.success(null, "Type de piece jointe desactive"));
    }

    @GetMapping("/api/v1/pieces-jointes/types-mouvements")
    public ResponseEntity<ApiResponse<List<ReferenceOptionResponse>>> listTypesMouvement() {
        return ResponseEntity.ok(ApiResponse.success(pieceJointeService.listTypesMouvement()));
    }

    @GetMapping("/api/v1/contrats/{contratId}/pieces-jointes")
    public ResponseEntity<ApiResponse<PiecesJointesContratResponse>> listContratPieces(
            @PathVariable Long contratId,
            @RequestParam(required = false) Long mouvementId
    ) {
        return ResponseEntity.ok(ApiResponse.success(pieceJointeService.listContratPieces(TenantContext.getCurrentAgence(), contratId, mouvementId)));
    }

    @PostMapping(path = "/api/v1/contrats/{contratId}/pieces-jointes", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<PieceJointeResponse>> upload(
            @PathVariable Long contratId,
            @RequestParam(required = false) Long mouvementId,
            @RequestParam(required = false) Long typePieceJointeId,
            @RequestParam(required = false) String customTypeLabel,
            @RequestPart("files") List<MultipartFile> files
    ) {
        return ResponseEntity.ok(ApiResponse.success(pieceJointeService.upload(
                TenantContext.getCurrentAgence(),
                contratId,
                mouvementId,
                typePieceJointeId,
                customTypeLabel,
                files
        ), "Piece jointe enregistree"));
    }

    @GetMapping("/api/v1/contrats/{contratId}/pieces-jointes/{pieceId}/download")
    public ResponseEntity<Resource> download(@PathVariable Long contratId, @PathVariable Long pieceId) {
        PieceJointeService.DownloadedPiece download = pieceJointeService.download(TenantContext.getCurrentAgence(), contratId, pieceId);
        return ResponseEntity.ok()
                .contentType(download.mediaType())
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(download.piece().getNomFichier())
                        .build()
                        .toString())
                .body(download.resource());
    }

    @DeleteMapping("/api/v1/contrats/{contratId}/pieces-jointes/{pieceId}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long contratId, @PathVariable Long pieceId) {
        pieceJointeService.delete(TenantContext.getCurrentAgence(), contratId, pieceId);
        return ResponseEntity.ok(ApiResponse.success(null, "Piece jointe supprimee"));
    }
}
