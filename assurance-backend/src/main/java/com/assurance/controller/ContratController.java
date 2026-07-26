package com.assurance.controller;

import com.assurance.dto.request.CreateContratRequest;
import com.assurance.dto.request.ConvertirProspectionRequest;
import com.assurance.dto.request.DevisPdfFilterRequest;
import com.assurance.dto.request.MouvementContratRequest;
import com.assurance.dto.request.UpsertAssistanceContratRequest;
import com.assurance.dto.request.UpsertCarteVerteRequest;
import com.assurance.dto.response.ApiResponse;
import com.assurance.dto.response.AssistanceContratContextResponse;
import com.assurance.dto.response.AssistanceContratResponse;
import com.assurance.dto.response.CarteVerteContextResponse;
import com.assurance.dto.response.CarteVerteResponse;
import com.assurance.dto.response.ContratActionsResponse;
import com.assurance.dto.response.ContratResponse;
import com.assurance.dto.response.QuittanceResponse;
import com.assurance.security.TenantContext;
import com.assurance.service.AssistanceContratService;
import com.assurance.service.CarteVerteService;
import com.assurance.service.ContratActionService;
import com.assurance.service.ContratService;
import com.assurance.service.DevisPdfService;
import com.assurance.service.MouvementContratService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/v1/contrats")
@RequiredArgsConstructor
public class ContratController {

    private final ContratService contratService;
    private final ContratActionService contratActionService;
    private final AssistanceContratService assistanceContratService;
    private final CarteVerteService carteVerteService;
    private final DevisPdfService devisPdfService;
    private final MouvementContratService mouvementContratService;

    @PostMapping
    public ResponseEntity<ApiResponse<ContratResponse>> create(@Valid @RequestBody CreateContratRequest request) {
        return ResponseEntity.ok(ApiResponse.success(contratService.create(request), "Contrat cree"));
    }

    @PostMapping("/drafts")
    public ResponseEntity<ApiResponse<ContratResponse>> createDraft(@RequestBody CreateContratRequest request) {
        if (request.getAgenceId() == null) {
            request.setAgenceId(TenantContext.getCurrentAgence());
        }
        return ResponseEntity.ok(ApiResponse.success(contratService.createDraft(request), "Brouillon cree"));
    }

    @GetMapping("/drafts/{id}")
    public ResponseEntity<ApiResponse<ContratResponse>> getDraft(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(contratService.getDraft(TenantContext.getCurrentAgence(), id)));
    }

    @PutMapping("/drafts/{id}")
    public ResponseEntity<ApiResponse<ContratResponse>> updateDraft(@PathVariable Long id, @RequestBody CreateContratRequest request) {
        return ResponseEntity.ok(ApiResponse.success(contratService.updateDraft(TenantContext.getCurrentAgence(), id, request), "Brouillon enregistre"));
    }

    @PutMapping("/drafts/{id}/vehicules/{index}")
    public ResponseEntity<ApiResponse<ContratResponse>> saveDraftVehicule(
            @PathVariable Long id,
            @PathVariable Integer index,
            @RequestBody CreateContratRequest.VehiculeInput request
    ) {
        return ResponseEntity.ok(ApiResponse.success(contratService.saveDraftVehicule(TenantContext.getCurrentAgence(), id, index, request), "Vehicule enregistre"));
    }

    @PutMapping("/drafts/{id}/vehicules/{index}/garanties")
    public ResponseEntity<ApiResponse<ContratResponse>> saveDraftVehiculeGaranties(
            @PathVariable Long id,
            @PathVariable Integer index,
            @RequestBody(required = false) List<CreateContratRequest.GarantieInput> request
    ) {
        return ResponseEntity.ok(ApiResponse.success(contratService.saveDraftVehiculeGaranties(TenantContext.getCurrentAgence(), id, index, request), "Garanties vehicule enregistrees"));
    }

    @PostMapping("/drafts/{id}/finaliser")
    public ResponseEntity<ApiResponse<ContratResponse>> finalizeDraft(@PathVariable Long id, @Valid @RequestBody CreateContratRequest request) {
        return ResponseEntity.ok(ApiResponse.success(contratService.finalizeDraft(TenantContext.getCurrentAgence(), id, request), "Contrat cree"));
    }

    @PostMapping("/previsualisation-quittance")
    public ResponseEntity<ApiResponse<QuittanceResponse>> previsualiserQuittanceCreation(@RequestBody CreateContratRequest request) {
        if (request.getAgenceId() == null) {
            request.setAgenceId(TenantContext.getCurrentAgence());
        }
        return ResponseEntity.ok(ApiResponse.success(contratService.previsualiserQuittance(request)));
    }

    @PostMapping("/{id}/renouvellements")
    public ResponseEntity<ApiResponse<ContratResponse>> renouveler(@PathVariable Long id, @Valid @RequestBody CreateContratRequest request) {
        return ResponseEntity.ok(ApiResponse.success(contratService.renouveler(TenantContext.getCurrentAgence(), id, request), "Contrat renouvele"));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<ContratResponse>>> list() {
        return ResponseEntity.ok(ApiResponse.success(contratService.list(TenantContext.getCurrentAgence())));
    }

    @GetMapping("/prospections")
    public ResponseEntity<ApiResponse<List<ContratResponse>>> listProspections() {
        return ResponseEntity.ok(ApiResponse.success(contratService.listProspections(TenantContext.getCurrentAgence())));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ContratResponse>> get(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(contratService.get(TenantContext.getCurrentAgence(), id)));
    }

    @PostMapping("/{id}/convertir-prospection")
    public ResponseEntity<ApiResponse<ContratResponse>> convertirProspection(
            @PathVariable Long id,
            @RequestBody(required = false) ConvertirProspectionRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(contratService.convertirProspection(TenantContext.getCurrentAgence(), id, request), "Devis converti en contrat"));
    }

    @PostMapping("/{id}/devis-pdf")
    public ResponseEntity<byte[]> devisPdf(@PathVariable Long id, @RequestBody(required = false) DevisPdfFilterRequest request) {
        byte[] pdf = devisPdfService.generate(TenantContext.getCurrentAgence(), id, request);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=devis-" + id + ".pdf")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }

    @GetMapping("/{id}/actions")
    public ResponseEntity<ApiResponse<ContratActionsResponse>> actions(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(contratActionService.getActions(TenantContext.getCurrentAgence(), id)));
    }

    @GetMapping("/{id}/quittances")
    public ResponseEntity<ApiResponse<List<QuittanceResponse>>> quittances(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(mouvementContratService.listQuittances(TenantContext.getCurrentAgence(), id)));
    }

    @PostMapping("/{id}/mouvements/previsualisation-quittance")
    public ResponseEntity<ApiResponse<QuittanceResponse>> previsualiserQuittance(
            @PathVariable Long id,
            @Valid @RequestBody MouvementContratRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(mouvementContratService.previsualiserQuittance(TenantContext.getCurrentAgence(), id, request)));
    }

    @PostMapping("/{id}/mouvements")
    public ResponseEntity<ApiResponse<QuittanceResponse>> creerMouvement(
            @PathVariable Long id,
            @Valid @RequestBody MouvementContratRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(mouvementContratService.creerMouvement(TenantContext.getCurrentAgence(), id, request), "Mouvement cree"));
    }

    @PostMapping("/{id}/assistances")
    public ResponseEntity<ApiResponse<AssistanceContratResponse>> upsertAssistance(
            @PathVariable Long id,
            @Valid @RequestBody UpsertAssistanceContratRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(assistanceContratService.upsert(TenantContext.getCurrentAgence(), id, request), "Assistance enregistree"));
    }

    @GetMapping("/{id}/assistances")
    public ResponseEntity<ApiResponse<AssistanceContratContextResponse>> assistanceContext(
            @PathVariable Long id,
            @RequestParam(required = false) Long mouvementId,
            @RequestParam(required = false) LocalDate dateSouscription
    ) {
        return ResponseEntity.ok(ApiResponse.success(assistanceContratService.getContext(TenantContext.getCurrentAgence(), id, mouvementId, dateSouscription)));
    }

    @DeleteMapping("/{id}/assistances/{assistanceId}")
    public ResponseEntity<ApiResponse<Void>> deleteAssistance(@PathVariable Long id, @PathVariable Long assistanceId) {
        assistanceContratService.deactivate(TenantContext.getCurrentAgence(), id, assistanceId);
        return ResponseEntity.ok(ApiResponse.success(null, "Assistance supprimee"));
    }

    @GetMapping("/{id}/cartes-vertes")
    public ResponseEntity<ApiResponse<CarteVerteContextResponse>> carteVerteContext(
            @PathVariable Long id,
            @RequestParam(required = false) Long mouvementId
    ) {
        return ResponseEntity.ok(ApiResponse.success(carteVerteService.getContext(TenantContext.getCurrentAgence(), id, mouvementId)));
    }

    @PostMapping("/{id}/cartes-vertes")
    public ResponseEntity<ApiResponse<CarteVerteResponse>> upsertCarteVerte(
            @PathVariable Long id,
            @Valid @RequestBody UpsertCarteVerteRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(carteVerteService.upsert(TenantContext.getCurrentAgence(), id, request), "Carte verte enregistree"));
    }

    @DeleteMapping("/{id}/cartes-vertes/{carteVerteId}")
    public ResponseEntity<ApiResponse<Void>> deleteCarteVerte(@PathVariable Long id, @PathVariable Long carteVerteId) {
        carteVerteService.deactivate(TenantContext.getCurrentAgence(), id, carteVerteId);
        return ResponseEntity.ok(ApiResponse.success(null, "Carte verte supprimee"));
    }
}
