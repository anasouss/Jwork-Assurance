package com.assurance.controller;

import com.assurance.dto.request.CreateContratRequest;
import com.assurance.dto.request.CreateRenouvellementDraftRequest;
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
import com.assurance.dto.response.EcheanceAutomobileResponse;
import com.assurance.dto.response.QuittanceResponse;
import com.assurance.enums.TypeContrat;
import com.assurance.security.TenantContext;
import com.assurance.service.AssistanceContratService;
import com.assurance.service.CarteVerteService;
import com.assurance.service.ContratActionService;
import com.assurance.service.ContratService;
import com.assurance.service.DevisPdfService;
import com.assurance.service.EcheanceProductionService;
import com.assurance.service.MouvementContratService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
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
    private final EcheanceProductionService echeanceProductionService;

    @PostMapping
    @PreAuthorize("hasAuthority('PERM_contrat:create')")
    public ResponseEntity<ApiResponse<ContratResponse>> create(@Valid @RequestBody CreateContratRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                contratService.create(TenantContext.getCurrentAgence(), request),
                "Contrat cree"
        ));
    }

    @PostMapping("/drafts")
    @PreAuthorize("hasAuthority('PERM_contrat:create')")
    public ResponseEntity<ApiResponse<ContratResponse>> createDraft(@RequestBody CreateContratRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                contratService.createDraft(TenantContext.getCurrentAgence(), request),
                "Brouillon cree"
        ));
    }

    @GetMapping("/drafts/{id}")
    @PreAuthorize("hasAnyAuthority('PERM_contrat:view', 'PERM_contrat:create', 'PERM_contrat:update')")
    public ResponseEntity<ApiResponse<ContratResponse>> getDraft(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(contratService.getDraft(TenantContext.getCurrentAgence(), id)));
    }

    @PutMapping("/drafts/{id}")
    @PreAuthorize("hasAnyAuthority('PERM_contrat:create', 'PERM_contrat:update')")
    public ResponseEntity<ApiResponse<ContratResponse>> updateDraft(@PathVariable Long id, @RequestBody CreateContratRequest request) {
        return ResponseEntity.ok(ApiResponse.success(contratService.updateDraft(TenantContext.getCurrentAgence(), id, request), "Brouillon enregistre"));
    }

    @PutMapping("/drafts/{id}/vehicules/{index}")
    @PreAuthorize("hasAnyAuthority('PERM_contrat:create', 'PERM_contrat:update')")
    public ResponseEntity<ApiResponse<ContratResponse>> saveDraftVehicule(
            @PathVariable Long id,
            @PathVariable Integer index,
            @RequestBody CreateContratRequest.VehiculeInput request
    ) {
        return ResponseEntity.ok(ApiResponse.success(contratService.saveDraftVehicule(TenantContext.getCurrentAgence(), id, index, request), "Vehicule enregistre"));
    }

    @PutMapping("/drafts/{id}/vehicules/{index}/garanties")
    @PreAuthorize("hasAnyAuthority('PERM_contrat:create', 'PERM_contrat:update')")
    public ResponseEntity<ApiResponse<ContratResponse>> saveDraftVehiculeGaranties(
            @PathVariable Long id,
            @PathVariable Integer index,
            @RequestBody(required = false) List<CreateContratRequest.GarantieInput> request
    ) {
        return ResponseEntity.ok(ApiResponse.success(contratService.saveDraftVehiculeGaranties(TenantContext.getCurrentAgence(), id, index, request), "Garanties vehicule enregistrees"));
    }

    @PutMapping("/drafts/{id}/remorques/{index}")
    @PreAuthorize("hasAnyAuthority('PERM_contrat:create', 'PERM_contrat:update')")
    public ResponseEntity<ApiResponse<ContratResponse>> saveDraftRemorque(
            @PathVariable Long id,
            @PathVariable Integer index,
            @RequestBody CreateContratRequest.RemorqueInput request
    ) {
        return ResponseEntity.ok(ApiResponse.success(contratService.saveDraftRemorque(TenantContext.getCurrentAgence(), id, index, request), "Remorque enregistree"));
    }

    @PutMapping("/drafts/{id}/remorques/{index}/garanties")
    @PreAuthorize("hasAnyAuthority('PERM_contrat:create', 'PERM_contrat:update')")
    public ResponseEntity<ApiResponse<ContratResponse>> saveDraftRemorqueGaranties(
            @PathVariable Long id,
            @PathVariable Integer index,
            @RequestBody(required = false) List<CreateContratRequest.GarantieInput> request
    ) {
        return ResponseEntity.ok(ApiResponse.success(contratService.saveDraftRemorqueGaranties(TenantContext.getCurrentAgence(), id, index, request), "Garanties remorque enregistrees"));
    }

    @PostMapping("/drafts/{id}/finaliser")
    @PreAuthorize("hasAnyAuthority('PERM_contrat:create', 'PERM_contrat:update')")
    public ResponseEntity<ApiResponse<ContratResponse>> finalizeDraft(@PathVariable Long id, @Valid @RequestBody CreateContratRequest request) {
        return ResponseEntity.ok(ApiResponse.success(contratService.finalizeDraft(TenantContext.getCurrentAgence(), id, request), "Contrat cree"));
    }

    @PostMapping("/previsualisation-quittance")
    @PreAuthorize("hasAuthority('PERM_contrat:create')")
    public ResponseEntity<ApiResponse<QuittanceResponse>> previsualiserQuittanceCreation(@RequestBody CreateContratRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                contratService.previsualiserQuittance(TenantContext.getCurrentAgence(), request)
        ));
    }

    @PostMapping("/{id}/renouvellements/brouillon")
    @PreAuthorize("hasAnyAuthority('PERM_contrat:renew', 'PERM_contrat:update')")
    public ResponseEntity<ApiResponse<ContratResponse>> createRenouvellementDraft(
            @PathVariable Long id,
            @Valid @RequestBody CreateRenouvellementDraftRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                contratService.createRenouvellementDraft(
                        TenantContext.getCurrentAgence(),
                        id,
                        request.getModeTermeRenouvellement()
                ),
                "Brouillon de renouvellement prêt"
        ));
    }

    @GetMapping
    @PreAuthorize("hasAuthority('PERM_contrat:view')")
    public ResponseEntity<ApiResponse<List<ContratResponse>>> list() {
        return ResponseEntity.ok(ApiResponse.success(contratService.list(TenantContext.getCurrentAgence())));
    }

    @GetMapping("/prospections")
    @PreAuthorize("hasAuthority('PERM_contrat:view')")
    public ResponseEntity<ApiResponse<List<ContratResponse>>> listProspections() {
        return ResponseEntity.ok(ApiResponse.success(contratService.listProspections(TenantContext.getCurrentAgence())));
    }

    @GetMapping("/echeances/automobile")
    @PreAuthorize("hasAuthority('PERM_contrat:view')")
    public ResponseEntity<ApiResponse<EcheanceAutomobileResponse>> echeancesAutomobile(
            @RequestParam LocalDate dateDu,
            @RequestParam LocalDate dateAu,
            @RequestParam(required = false) Long compagnieId,
            @RequestParam(required = false) TypeContrat typeContrat,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") Integer page,
            @RequestParam(defaultValue = "25") Integer size
    ) {
        return ResponseEntity.ok(ApiResponse.success(echeanceProductionService.searchAutomobile(
                TenantContext.getCurrentAgence(),
                dateDu,
                dateAu,
                compagnieId,
                typeContrat,
                search,
                page,
                size
        )));
    }

    @GetMapping("/echeances/automobile/export")
    @PreAuthorize("hasAuthority('PERM_contrat:view')")
    public ResponseEntity<byte[]> exportEcheancesAutomobile(
            @RequestParam LocalDate dateDu,
            @RequestParam LocalDate dateAu,
            @RequestParam(required = false) Long compagnieId,
            @RequestParam(required = false) TypeContrat typeContrat,
            @RequestParam(required = false) String search
    ) {
        byte[] export = echeanceProductionService.exportAutomobile(
                TenantContext.getCurrentAgence(),
                dateDu,
                dateAu,
                compagnieId,
                typeContrat,
                search
        );
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=echeances-automobile-" + dateDu + "-" + dateAu + ".xls")
                .contentType(MediaType.parseMediaType("application/vnd.ms-excel"))
                .body(export);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('PERM_contrat:view')")
    public ResponseEntity<ApiResponse<ContratResponse>> get(
            @PathVariable Long id,
            @RequestParam(required = false) Long mouvementId
    ) {
        return ResponseEntity.ok(ApiResponse.success(contratService.get(TenantContext.getCurrentAgence(), id, mouvementId)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('PERM_contrat:delete', 'PERM_contrat:update')")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        contratService.deleteContrat(TenantContext.getCurrentAgence(), id);
        return ResponseEntity.ok(ApiResponse.success(null, "Contrat supprime"));
    }

    @DeleteMapping("/{id}/mouvements/{mouvementId}")
    @PreAuthorize("hasAnyAuthority('PERM_avenant:delete', 'PERM_contrat:update')")
    public ResponseEntity<ApiResponse<Void>> deleteMouvement(@PathVariable Long id, @PathVariable Long mouvementId) {
        contratService.deleteMouvement(TenantContext.getCurrentAgence(), id, mouvementId);
        return ResponseEntity.ok(ApiResponse.success(null, "Mouvement supprime"));
    }

    @PostMapping("/{id}/convertir-prospection")
    @PreAuthorize("hasAuthority('PERM_contrat:update')")
    public ResponseEntity<ApiResponse<ContratResponse>> convertirProspection(
            @PathVariable Long id,
            @RequestBody(required = false) ConvertirProspectionRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(contratService.convertirProspection(TenantContext.getCurrentAgence(), id, request), "Devis converti en contrat"));
    }

    @PostMapping("/{id}/devis-pdf")
    @PreAuthorize("hasAuthority('PERM_contrat:view')")
    public ResponseEntity<byte[]> devisPdf(@PathVariable Long id, @RequestBody(required = false) DevisPdfFilterRequest request) {
        byte[] pdf = devisPdfService.generate(TenantContext.getCurrentAgence(), id, request);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=devis-" + id + ".pdf")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }

    @GetMapping("/{id}/actions")
    @PreAuthorize("hasAuthority('PERM_contrat:view')")
    public ResponseEntity<ApiResponse<ContratActionsResponse>> actions(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(contratActionService.getActions(TenantContext.getCurrentAgence(), id)));
    }

    @GetMapping("/{id}/quittances")
    @PreAuthorize("hasAnyAuthority('PERM_quittance:view', 'PERM_contrat:view')")
    public ResponseEntity<ApiResponse<List<QuittanceResponse>>> quittances(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(mouvementContratService.listQuittances(TenantContext.getCurrentAgence(), id)));
    }

    @PostMapping("/{id}/mouvements/previsualisation-quittance")
    @PreAuthorize("hasAuthority('PERM_contrat:update')")
    public ResponseEntity<ApiResponse<QuittanceResponse>> previsualiserQuittance(
            @PathVariable Long id,
            @Valid @RequestBody MouvementContratRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(mouvementContratService.previsualiserQuittance(TenantContext.getCurrentAgence(), id, request)));
    }

    @PostMapping("/{id}/mouvements")
    @PreAuthorize("hasAuthority('PERM_contrat:update')")
    public ResponseEntity<ApiResponse<QuittanceResponse>> creerMouvement(
            @PathVariable Long id,
            @Valid @RequestBody MouvementContratRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(mouvementContratService.creerMouvement(TenantContext.getCurrentAgence(), id, request), "Mouvement cree"));
    }

    @PostMapping("/{id}/assistances")
    @PreAuthorize("hasAnyAuthority('PERM_assistance:manage', 'PERM_contrat:update')")
    public ResponseEntity<ApiResponse<AssistanceContratResponse>> upsertAssistance(
            @PathVariable Long id,
            @Valid @RequestBody UpsertAssistanceContratRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(assistanceContratService.upsert(TenantContext.getCurrentAgence(), id, request), "Assistance enregistree"));
    }

    @GetMapping("/{id}/assistances")
    @PreAuthorize("hasAnyAuthority('PERM_assistance:view', 'PERM_contrat:view')")
    public ResponseEntity<ApiResponse<AssistanceContratContextResponse>> assistanceContext(
            @PathVariable Long id,
            @RequestParam(required = false) Long mouvementId,
            @RequestParam(required = false) LocalDate dateSouscription
    ) {
        return ResponseEntity.ok(ApiResponse.success(assistanceContratService.getContext(TenantContext.getCurrentAgence(), id, mouvementId, dateSouscription)));
    }

    @DeleteMapping("/{id}/assistances/{assistanceId}")
    @PreAuthorize("hasAnyAuthority('PERM_assistance:manage', 'PERM_contrat:update')")
    public ResponseEntity<ApiResponse<Void>> deleteAssistance(@PathVariable Long id, @PathVariable Long assistanceId) {
        assistanceContratService.deactivate(TenantContext.getCurrentAgence(), id, assistanceId);
        return ResponseEntity.ok(ApiResponse.success(null, "Assistance supprimee"));
    }

    @GetMapping("/{id}/cartes-vertes")
    @PreAuthorize("hasAnyAuthority('PERM_carte-verte:view', 'PERM_contrat:view')")
    public ResponseEntity<ApiResponse<CarteVerteContextResponse>> carteVerteContext(
            @PathVariable Long id,
            @RequestParam(required = false) Long mouvementId
    ) {
        return ResponseEntity.ok(ApiResponse.success(carteVerteService.getContext(TenantContext.getCurrentAgence(), id, mouvementId)));
    }

    @PostMapping("/{id}/cartes-vertes")
    @PreAuthorize("hasAnyAuthority('PERM_carte-verte:manage', 'PERM_contrat:update')")
    public ResponseEntity<ApiResponse<CarteVerteResponse>> upsertCarteVerte(
            @PathVariable Long id,
            @Valid @RequestBody UpsertCarteVerteRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(carteVerteService.upsert(TenantContext.getCurrentAgence(), id, request), "Carte verte enregistree"));
    }

    @DeleteMapping("/{id}/cartes-vertes/{carteVerteId}")
    @PreAuthorize("hasAnyAuthority('PERM_carte-verte:manage', 'PERM_contrat:update')")
    public ResponseEntity<ApiResponse<Void>> deleteCarteVerte(@PathVariable Long id, @PathVariable Long carteVerteId) {
        carteVerteService.deactivate(TenantContext.getCurrentAgence(), id, carteVerteId);
        return ResponseEntity.ok(ApiResponse.success(null, "Carte verte supprimee"));
    }
}
