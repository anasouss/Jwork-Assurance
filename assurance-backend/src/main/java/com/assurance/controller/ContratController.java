package com.assurance.controller;

import com.assurance.dto.request.CreateContratRequest;
import com.assurance.dto.request.MouvementContratRequest;
import com.assurance.dto.request.UpsertAssistanceContratRequest;
import com.assurance.dto.response.ApiResponse;
import com.assurance.dto.response.AssistanceContratContextResponse;
import com.assurance.dto.response.AssistanceContratResponse;
import com.assurance.dto.response.ContratActionsResponse;
import com.assurance.dto.response.ContratResponse;
import com.assurance.dto.response.QuittanceResponse;
import com.assurance.security.TenantContext;
import com.assurance.service.AssistanceContratService;
import com.assurance.service.ContratActionService;
import com.assurance.service.ContratService;
import com.assurance.service.MouvementContratService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
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

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ContratResponse>> get(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(contratService.get(TenantContext.getCurrentAgence(), id)));
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
}
