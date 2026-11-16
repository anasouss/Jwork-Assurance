package com.assurance.controller;

import com.assurance.dto.request.UpsertSpecialitePrestataireRequest;
import com.assurance.dto.response.*;
import com.assurance.enums.ModeReparationSinistre;
import com.assurance.enums.TypePrestataireSinistre;
import com.assurance.security.TenantContext;
import com.assurance.service.PrestataireSinistreService;
import com.assurance.service.SinistreIntervenantService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/v1/sinistres/prestataires")
@RequiredArgsConstructor
public class PrestataireSinistreController {
    private final PrestataireSinistreService service;
    private final SinistreIntervenantService intervenants;
    private final com.assurance.service.DomaineInterventionSinistreService domaines;
    private final com.assurance.service.PrestataireDirectoryExportService exportService;

    @GetMapping
    @PreAuthorize("hasAuthority('PERM_prestataire-sinistre:view')")
    public ApiResponse<PagedResponse<SinistreIntervenantResponse>> directory(
            @RequestParam(defaultValue = "GARAGE") TypePrestataireSinistre typePrestataire,
            @RequestParam(defaultValue = "false") boolean tousOperateurs,
            @RequestParam(defaultValue = "false") boolean includeInactive,
            @RequestParam(required = false) String query,
            @RequestParam(required = false) Long villeId,
            @RequestParam(required = false) Long compagnieId,
            @RequestParam(required = false) Long specialiteId,
            @RequestParam(required = false) Long brancheId,
            @RequestParam(required = false) Long domaineId,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "25") int size) {
        if (tousOperateurs) {
            return ApiResponse.success(intervenants.directoryAll(TenantContext.getCurrentAgence(),
                    includeInactive, query, villeId, compagnieId, specialiteId, brancheId, domaineId, page, size));
        }
        return ApiResponse.success(intervenants.directory(TenantContext.getCurrentAgence(), typePrestataire,
                includeInactive, query, villeId, compagnieId, specialiteId, brancheId, domaineId, page, size));
    }

    @GetMapping("/export")
    @PreAuthorize("hasAuthority('PERM_prestataire-sinistre:export') and hasAuthority('PERM_prestataire-sinistre:view')")
    public org.springframework.http.ResponseEntity<byte[]> export(
            @RequestParam(defaultValue = "GARAGE") TypePrestataireSinistre typePrestataire,
            @RequestParam(defaultValue = "false") boolean tousOperateurs,
            @RequestParam(defaultValue = "false") boolean includeInactive,
            @RequestParam(required = false) String query,
            @RequestParam(required = false) Long villeId,
            @RequestParam(required = false) Long compagnieId,
            @RequestParam(required = false) Long specialiteId,
            @RequestParam(required = false) Long brancheId,
            @RequestParam(required = false) Long domaineId) {
        byte[] bytes = exportService.export(TenantContext.getCurrentAgence(),
                new com.assurance.service.PrestataireDirectoryExportService.Filters(typePrestataire, tousOperateurs,
                        includeInactive, query, villeId, compagnieId, specialiteId, brancheId, domaineId));
        return org.springframework.http.ResponseEntity.ok()
                .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=prestataires.xlsx")
                .header(org.springframework.http.HttpHeaders.CACHE_CONTROL, "no-store")
                .contentType(org.springframework.http.MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(bytes);
    }

    @GetMapping("/domaines")
    @PreAuthorize("hasAnyAuthority('PERM_domaine-prestataire:view', 'PERM_prestataire-sinistre:view', 'PERM_prestataire-sinistre:create', 'PERM_prestataire-sinistre:update', 'PERM_specialite-prestataire:view', 'PERM_specialite-prestataire:create', 'PERM_specialite-prestataire:update')")
    public ApiResponse<List<DomaineInterventionResponse>> domains() {
        return ApiResponse.success(domaines.list(TenantContext.getCurrentAgence()));
    }

    @PostMapping("/domaines")
    @PreAuthorize("hasAuthority('PERM_domaine-prestataire:create')")
    public ApiResponse<DomaineInterventionResponse> createDomain(@Valid @RequestBody com.assurance.dto.request.UpsertDomaineInterventionRequest request) {
        return ApiResponse.success(domaines.save(TenantContext.getCurrentAgence(), null, request));
    }

    @PutMapping("/domaines/{id}")
    @PreAuthorize("hasAuthority('PERM_domaine-prestataire:update')")
    public ApiResponse<DomaineInterventionResponse> updateDomain(@PathVariable Long id, @Valid @RequestBody com.assurance.dto.request.UpsertDomaineInterventionRequest request) {
        return ApiResponse.success(domaines.save(TenantContext.getCurrentAgence(), id, request));
    }

    @PostMapping("/medicaux")
    @PreAuthorize("hasAuthority('PERM_prestataire-sinistre:create')")
    public ApiResponse<SinistreIntervenantResponse> createMedical(@Valid @RequestBody com.assurance.dto.request.UpsertPrestataireMedicalRequest request) {
        return ApiResponse.success(intervenants.saveMedical(TenantContext.getCurrentAgence(), null, request));
    }

    @PutMapping("/medicaux/{id}")
    @PreAuthorize("hasAuthority('PERM_prestataire-sinistre:update')")
    public ApiResponse<SinistreIntervenantResponse> updateMedical(@PathVariable Long id, @Valid @RequestBody com.assurance.dto.request.UpsertPrestataireMedicalRequest request) {
        return ApiResponse.success(intervenants.saveMedical(TenantContext.getCurrentAgence(), id, request));
    }

    @GetMapping("/eligibles")
    @PreAuthorize("hasAnyAuthority('PERM_sinistre:view', 'PERM_sinistre:create', 'PERM_prestataire-sinistre:view')")
    public ApiResponse<List<SinistreIntervenantResponse>> eligible(
            @RequestParam TypePrestataireSinistre typePrestataire,
            @RequestParam(required = false) Long sinistreId,
            @RequestParam(required = false) Long contratId,
            @RequestParam(required = false) Long vehiculeId,
            @RequestParam(required = false) LocalDate dateSinistre,
            @RequestParam(required = false) LocalDate dateIntervention,
            @RequestParam(required = false) Set<Long> garantieIds,
            @RequestParam(required = false) ModeReparationSinistre modeReparation) {
        return ApiResponse.success(intervenants.eligible(TenantContext.getCurrentAgence(), typePrestataire,
                sinistreId, contratId, vehiculeId, dateSinistre, garantieIds, dateIntervention, modeReparation));
    }

    @GetMapping("/options")
    @PreAuthorize("hasAnyAuthority('PERM_prestataire-sinistre:view', 'PERM_prestataire-sinistre:create', 'PERM_prestataire-sinistre:update', 'PERM_specialite-prestataire:view', 'PERM_specialite-prestataire:create', 'PERM_specialite-prestataire:update', 'PERM_domaine-prestataire:view', 'PERM_domaine-prestataire:create', 'PERM_domaine-prestataire:update')")
    public ApiResponse<Map<String, List<SpecialitePrestataireResponse.Reference>>> options() {
        return ApiResponse.success(service.options());
    }

    @GetMapping("/specialites")
    @PreAuthorize("hasAnyAuthority('PERM_specialite-prestataire:view', 'PERM_specialite-prestataire:create', 'PERM_specialite-prestataire:update', 'PERM_prestataire-sinistre:view', 'PERM_prestataire-sinistre:create', 'PERM_prestataire-sinistre:update')")
    public ApiResponse<List<SpecialitePrestataireResponse>> specialties() {
        return ApiResponse.success(service.specialites(TenantContext.getCurrentAgence()));
    }

    @PostMapping("/specialites")
    @PreAuthorize("hasAuthority('PERM_specialite-prestataire:create')")
    public ApiResponse<SpecialitePrestataireResponse> create(@Valid @RequestBody UpsertSpecialitePrestataireRequest request) {
        return ApiResponse.success(service.saveSpecialite(TenantContext.getCurrentAgence(), null, request));
    }

    @PutMapping("/specialites/{id}")
    @PreAuthorize("hasAuthority('PERM_specialite-prestataire:update')")
    public ApiResponse<SpecialitePrestataireResponse> update(@PathVariable Long id, @Valid @RequestBody UpsertSpecialitePrestataireRequest request) {
        return ApiResponse.success(service.saveSpecialite(TenantContext.getCurrentAgence(), id, request));
    }
}
