package com.assurance.controller;

import com.assurance.dto.request.AddLotAttestationRequest;
import com.assurance.dto.request.AddLotsAttestationRequest;
import com.assurance.dto.request.CancelAttestationStockRequest;
import com.assurance.dto.request.CreateLivraisonAttestationRequest;
import com.assurance.dto.request.UpdateAttestationStockSettingsRequest;
import com.assurance.dto.request.UpsertSeuilStockAttestationRequest;
import com.assurance.dto.response.ApiResponse;
import com.assurance.dto.response.AttestationNumeroValidationResponse;
import com.assurance.dto.response.AttestationStockDashboardResponse;
import com.assurance.dto.response.AttestationStockItemResponse;
import com.assurance.dto.response.AttestationStockSettingsResponse;
import com.assurance.dto.response.LivraisonAttestationResponse;
import com.assurance.dto.response.SeuilStockAttestationResponse;
import com.assurance.entity.Contrat;
import com.assurance.entity.Usage;
import com.assurance.enums.SourceLivraisonAttestation;
import com.assurance.enums.StatutAttestationStock;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.ContratRepository;
import com.assurance.repository.UsageRepository;
import com.assurance.security.TenantContext;
import com.assurance.service.AttestationStockService;
import com.assurance.service.LivraisonAttestationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
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

    @GetMapping("/dashboard")
    @PreAuthorize("hasAnyAuthority('PERM_attestation-stock:view', 'PERM_contrat:view')")
    public ResponseEntity<ApiResponse<AttestationStockDashboardResponse>> dashboard() {
        return ResponseEntity.ok(ApiResponse.success(attestationStockService.dashboard(TenantContext.getCurrentAgence())));
    }

    @GetMapping("/attestations")
    @PreAuthorize("hasAnyAuthority('PERM_attestation-stock:view', 'PERM_contrat:view')")
    public ResponseEntity<ApiResponse<List<AttestationStockItemResponse>>> attestations(
            @RequestParam(required = false) Long compagnieAssuranceId,
            @RequestParam(required = false) Long groupeUsageAttestationId,
            @RequestParam(required = false) StatutAttestationStock statut,
            @RequestParam(required = false) String numero,
            @RequestParam(defaultValue = "100") Integer limit
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                attestationStockService.rechercher(
                        TenantContext.getCurrentAgence(),
                        compagnieAssuranceId,
                        groupeUsageAttestationId,
                        statut,
                        numero,
                        limit
                )
        ));
    }

    @PostMapping("/attestations/{id}/annuler")
    @PreAuthorize("hasAnyAuthority('PERM_attestation-stock:cancel', 'PERM_attestation-stock:manage', 'PERM_contrat:update')")
    public ResponseEntity<ApiResponse<AttestationStockItemResponse>> annulerAttestation(
            @PathVariable Long id,
            @Valid @RequestBody CancelAttestationStockRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                attestationStockService.annuler(TenantContext.getCurrentAgence(), id, request),
                "Attestation annulee"
        ));
    }

    @GetMapping("/settings")
    @PreAuthorize("hasAnyAuthority('PERM_attestation-stock:view', 'PERM_contrat:view')")
    public ResponseEntity<ApiResponse<AttestationStockSettingsResponse>> settings() {
        return ResponseEntity.ok(ApiResponse.success(attestationStockService.settings(TenantContext.getCurrentAgence())));
    }

    @PutMapping("/settings")
    @PreAuthorize("hasAnyAuthority('PERM_attestation-stock:manage', 'PERM_contrat:update')")
    public ResponseEntity<ApiResponse<AttestationStockSettingsResponse>> updateSettings(
            @RequestBody UpdateAttestationStockSettingsRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                attestationStockService.updateSettings(TenantContext.getCurrentAgence(), request),
                "Parametres du stock attestations mis a jour"
        ));
    }

    @GetMapping("/seuils")
    @PreAuthorize("hasAnyAuthority('PERM_attestation-stock:view', 'PERM_contrat:view')")
    public ResponseEntity<ApiResponse<List<SeuilStockAttestationResponse>>> seuils() {
        return ResponseEntity.ok(ApiResponse.success(attestationStockService.listerSeuils()));
    }

    @PostMapping("/seuils")
    @PreAuthorize("hasAnyAuthority('PERM_attestation-stock:manage', 'PERM_contrat:update')")
    public ResponseEntity<ApiResponse<SeuilStockAttestationResponse>> creerSeuil(
            @Valid @RequestBody UpsertSeuilStockAttestationRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(attestationStockService.creerSeuil(request), "Seuil stock cree"));
    }

    @PutMapping("/seuils/{id}")
    @PreAuthorize("hasAnyAuthority('PERM_attestation-stock:manage', 'PERM_contrat:update')")
    public ResponseEntity<ApiResponse<SeuilStockAttestationResponse>> modifierSeuil(
            @PathVariable Long id,
            @Valid @RequestBody UpsertSeuilStockAttestationRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(attestationStockService.modifierSeuil(id, request), "Seuil stock modifie"));
    }

    @PostMapping("/livraisons")
    @PreAuthorize("hasAnyAuthority('PERM_attestation-stock:manage', 'PERM_contrat:update')")
    public ResponseEntity<ApiResponse<LivraisonAttestationResponse>> creerLivraison(
            @Valid @RequestBody CreateLivraisonAttestationRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                livraisonAttestationService.creer(TenantContext.getCurrentAgence(), request),
                "Livraison d'attestations creee"
        ));
    }

    @GetMapping("/livraisons")
    @PreAuthorize("hasAnyAuthority('PERM_attestation-stock:view', 'PERM_contrat:view')")
    public ResponseEntity<ApiResponse<List<LivraisonAttestationResponse>>> listerLivraisons(
            @RequestParam(required = false) SourceLivraisonAttestation source
    ) {
        return ResponseEntity.ok(ApiResponse.success(livraisonAttestationService.lister(TenantContext.getCurrentAgence(), source)));
    }

    @PostMapping("/livraisons/{id}/lots")
    @PreAuthorize("hasAnyAuthority('PERM_attestation-stock:manage', 'PERM_contrat:update')")
    public ResponseEntity<ApiResponse<LivraisonAttestationResponse>> ajouterLot(
            @PathVariable Long id,
            @Valid @RequestBody AddLotAttestationRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                livraisonAttestationService.ajouterLot(id, request),
                "Lot d'attestations ajoute"
        ));
    }

    @PostMapping("/livraisons/{id}/reception")
    @PreAuthorize("hasAnyAuthority('PERM_attestation-stock:manage', 'PERM_contrat:update')")
    public ResponseEntity<ApiResponse<LivraisonAttestationResponse>> ajouterLots(
            @PathVariable Long id,
            @Valid @RequestBody AddLotsAttestationRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                livraisonAttestationService.ajouterLots(id, request.getLots()),
                "Lots d'attestations ajoutes"
        ));
    }

    @PostMapping("/livraisons/{id}/valider")
    @PreAuthorize("hasAnyAuthority('PERM_attestation-stock:manage', 'PERM_contrat:update')")
    public ResponseEntity<ApiResponse<LivraisonAttestationResponse>> valider(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(
                livraisonAttestationService.valider(id),
                "Livraison d'attestations validee"
        ));
    }

    @GetMapping("/disponibles")
    @PreAuthorize("hasAnyAuthority('PERM_attestation-stock:view', 'PERM_contrat:create', 'PERM_contrat:update')")
    public ResponseEntity<ApiResponse<List<String>>> disponibles(
            @RequestParam Long contratId,
            @RequestParam Long usageId,
            @RequestParam(defaultValue = "") String fragment
    ) {
        Contrat contrat = contratRepository.findByAgenceIdAndId(TenantContext.getCurrentAgence(), contratId)
                .orElseThrow(() -> new ResourceNotFoundException("Contrat", contratId));
        Usage usage = usageRepository.findById(usageId)
                .orElseThrow(() -> new ResourceNotFoundException("Usage", usageId));
        return ResponseEntity.ok(ApiResponse.success(attestationStockService.listerDisponibles(fragment, contrat, usage)));
    }

    @GetMapping("/suggestions")
    @PreAuthorize("hasAnyAuthority('PERM_attestation-stock:view', 'PERM_contrat:create', 'PERM_contrat:update')")
    public ResponseEntity<ApiResponse<List<String>>> suggestions(
            @RequestParam Long compagnieAssuranceId,
            @RequestParam Long usageId,
            @RequestParam(defaultValue = "") String fragment
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                attestationStockService.listerDisponibles(TenantContext.getCurrentAgence(), compagnieAssuranceId, usageId, fragment)
        ));
    }

    @GetMapping("/validation")
    @PreAuthorize("hasAnyAuthority('PERM_attestation-stock:view', 'PERM_contrat:create', 'PERM_contrat:update')")
    public ResponseEntity<ApiResponse<AttestationNumeroValidationResponse>> validation(
            @RequestParam Long compagnieAssuranceId,
            @RequestParam Long usageId,
            @RequestParam(defaultValue = "") String numero,
            @RequestParam(required = false) String numeroCourant
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                attestationStockService.validerNumero(TenantContext.getCurrentAgence(), compagnieAssuranceId, usageId, numero, numeroCourant)
        ));
    }
}
