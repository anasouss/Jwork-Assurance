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

    @GetMapping
    @PreAuthorize("hasAuthority('PERM_sinistre:referentiel')")
    public ApiResponse<PagedResponse<SinistreIntervenantResponse>> directory(
            @RequestParam(defaultValue = "GARAGE") TypePrestataireSinistre typePrestataire,
            @RequestParam(defaultValue = "false") boolean includeInactive,
            @RequestParam(required = false) String query,
            @RequestParam(required = false) Long villeId,
            @RequestParam(required = false) Long compagnieId,
            @RequestParam(required = false) Long specialiteId,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "25") int size) {
        return ApiResponse.success(intervenants.directory(TenantContext.getCurrentAgence(), typePrestataire,
                includeInactive, query, villeId, compagnieId, specialiteId, page, size));
    }

    @GetMapping("/eligibles")
    @PreAuthorize("hasAnyAuthority('PERM_sinistre:view', 'PERM_sinistre:create', 'PERM_sinistre:manage', 'PERM_sinistre:finance', 'PERM_sinistre:referentiel')")
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
    @PreAuthorize("hasAuthority('PERM_sinistre:referentiel')")
    public ApiResponse<Map<String, List<SpecialitePrestataireResponse.Reference>>> options() {
        return ApiResponse.success(service.options());
    }

    @GetMapping("/specialites")
    @PreAuthorize("hasAuthority('PERM_sinistre:referentiel')")
    public ApiResponse<List<SpecialitePrestataireResponse>> specialties() {
        return ApiResponse.success(service.specialites(TenantContext.getCurrentAgence()));
    }

    @PostMapping("/specialites")
    @PreAuthorize("hasAuthority('PERM_sinistre:referentiel')")
    public ApiResponse<SpecialitePrestataireResponse> create(@Valid @RequestBody UpsertSpecialitePrestataireRequest request) {
        return ApiResponse.success(service.saveSpecialite(TenantContext.getCurrentAgence(), null, request));
    }

    @PutMapping("/specialites/{id}")
    @PreAuthorize("hasAuthority('PERM_sinistre:referentiel')")
    public ApiResponse<SpecialitePrestataireResponse> update(@PathVariable Long id, @Valid @RequestBody UpsertSpecialitePrestataireRequest request) {
        return ApiResponse.success(service.saveSpecialite(TenantContext.getCurrentAgence(), id, request));
    }
}
