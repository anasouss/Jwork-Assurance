package com.assurance.controller;

import com.assurance.dto.request.AddLotAttestationRequest;
import com.assurance.dto.request.CreateLivraisonAttestationRequest;
import com.assurance.dto.response.ApiResponse;
import com.assurance.dto.response.LivraisonAttestationResponse;
import com.assurance.entity.Contrat;
import com.assurance.entity.Usage;
import com.assurance.enums.SourceLivraisonAttestation;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.ContratRepository;
import com.assurance.repository.UsageRepository;
import com.assurance.security.TenantContext;
import com.assurance.service.AttestationStockService;
import com.assurance.service.LivraisonAttestationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/attestations-stock")
@RequiredArgsConstructor
public class AttestationStockController {

    private final LivraisonAttestationService livraisonAttestationService;
    private final AttestationStockService attestationStockService;
    private final ContratRepository contratRepository;
    private final UsageRepository usageRepository;

    @PostMapping("/livraisons")
    public ResponseEntity<ApiResponse<LivraisonAttestationResponse>> creerLivraison(
            @Valid @RequestBody CreateLivraisonAttestationRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                livraisonAttestationService.creer(TenantContext.getCurrentAgence(), request),
                "Livraison d'attestations creee"
        ));
    }

    @GetMapping("/livraisons")
    public ResponseEntity<ApiResponse<List<LivraisonAttestationResponse>>> listerLivraisons(
            @RequestParam(required = false) SourceLivraisonAttestation source
    ) {
        return ResponseEntity.ok(ApiResponse.success(livraisonAttestationService.lister(TenantContext.getCurrentAgence(), source)));
    }

    @PostMapping("/livraisons/{id}/lots")
    public ResponseEntity<ApiResponse<LivraisonAttestationResponse>> ajouterLot(
            @PathVariable String id,
            @Valid @RequestBody AddLotAttestationRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                livraisonAttestationService.ajouterLot(id, request),
                "Lot d'attestations ajoute"
        ));
    }

    @PostMapping("/livraisons/{id}/valider")
    public ResponseEntity<ApiResponse<LivraisonAttestationResponse>> valider(@PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.success(
                livraisonAttestationService.valider(id),
                "Livraison d'attestations validee"
        ));
    }

    @GetMapping("/disponibles")
    public ResponseEntity<ApiResponse<List<String>>> disponibles(
            @RequestParam String contratId,
            @RequestParam String usageId,
            @RequestParam(defaultValue = "") String fragment
    ) {
        Contrat contrat = contratRepository.findByAgenceIdAndId(TenantContext.getCurrentAgence(), contratId)
                .orElseThrow(() -> new ResourceNotFoundException("Contrat", contratId));
        Usage usage = usageRepository.findById(usageId)
                .orElseThrow(() -> new ResourceNotFoundException("Usage", usageId));
        return ResponseEntity.ok(ApiResponse.success(attestationStockService.listerDisponibles(fragment, contrat, usage)));
    }
}
