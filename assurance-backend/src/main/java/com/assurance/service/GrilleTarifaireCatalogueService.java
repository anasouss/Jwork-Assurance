package com.assurance.service;

import com.assurance.dto.response.GrilleTarifaireCatalogueResponse;
import com.assurance.entity.Convention;
import com.assurance.entity.FormuleGarantiePersonne;
import com.assurance.entity.GrilleTarifaire;
import com.assurance.entity.LigneGrilleTarifaire;
import com.assurance.entity.Usage;
import com.assurance.repository.ConventionRepository;
import com.assurance.repository.FormuleGarantiePersonneRepository;
import com.assurance.repository.GrilleTarifaireRepository;
import com.assurance.repository.LigneGrilleTarifaireRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class GrilleTarifaireCatalogueService {

    private final GrilleTarifaireRepository grilleTarifaireRepository;
    private final LigneGrilleTarifaireRepository ligneGrilleTarifaireRepository;
    private final FormuleGarantiePersonneRepository formuleGarantiePersonneRepository;
    private final ConventionRepository conventionRepository;

    @Transactional(readOnly = true)
    public List<GrilleTarifaireCatalogueResponse> search(
            Long agenceId,
            String query,
            Long compagnieAssuranceId,
            Long conventionId,
            Long usageId,
            Boolean actif
    ) {
        List<GrilleTarifaire> grilles = grilleTarifaireRepository.findAccessibleAll(agenceId);
        if (grilles.isEmpty()) {
            return List.of();
        }

        Set<Long> grilleIds = grilles.stream().map(GrilleTarifaire::getId).collect(Collectors.toSet());
        List<LigneGrilleTarifaire> lignes = ligneGrilleTarifaireRepository
                .findByGrilleTarifaireIdInAndActifTrue(grilleIds);
        List<FormuleGarantiePersonne> formules = formuleGarantiePersonneRepository
                .findByGrilleTarifaireIdInAndActifTrue(grilleIds);
        List<Convention> conventions = conventionRepository.findByAgenceIdAndActifTrueOrderByIntituleAsc(agenceId);

        Map<Long, Long> lineCounts = new HashMap<>();
        Map<Long, Long> formulaCounts = new HashMap<>();
        Map<Long, LinkedHashMap<Long, Usage>> usagesByGrid = new HashMap<>();
        Map<Long, List<Convention>> conventionsByGrid = new HashMap<>();

        for (LigneGrilleTarifaire ligne : lignes) {
            Long grilleId = ligne.getGrilleTarifaire().getId();
            lineCounts.merge(grilleId, 1L, Long::sum);
            addUsage(usagesByGrid, grilleId, ligne.getUsage());
        }
        for (FormuleGarantiePersonne formule : formules) {
            Long grilleId = formule.getGrilleTarifaire().getId();
            formulaCounts.merge(grilleId, 1L, Long::sum);
            addUsage(usagesByGrid, grilleId, formule.getUsage());
        }
        for (Convention convention : conventions) {
            if (convention.getGrilleTarifaire() != null) {
                conventionsByGrid.computeIfAbsent(convention.getGrilleTarifaire().getId(), ignored -> new ArrayList<>())
                        .add(convention);
            }
        }

        String normalizedQuery = normalize(query);
        return grilles.stream()
                .filter(grille -> compagnieAssuranceId == null
                        || grille.getCompagnieAssurance().getId().equals(compagnieAssuranceId))
                .filter(grille -> actif == null || actif.equals(grille.getActif()))
                .filter(grille -> conventionId == null || conventionsByGrid
                        .getOrDefault(grille.getId(), List.of()).stream()
                        .anyMatch(convention -> convention.getId().equals(conventionId)))
                .filter(grille -> usageId == null || usagesByGrid
                        .getOrDefault(grille.getId(), new LinkedHashMap<>()).containsKey(usageId))
                .filter(grille -> matches(grille, conventionsByGrid.getOrDefault(grille.getId(), List.of()), normalizedQuery))
                .sorted(Comparator.comparing(GrilleTarifaire::getUpdatedAt).reversed())
                .map(grille -> toResponse(
                        grille,
                        conventionsByGrid.getOrDefault(grille.getId(), List.of()),
                        usagesByGrid.getOrDefault(grille.getId(), new LinkedHashMap<>()),
                        lineCounts.getOrDefault(grille.getId(), 0L),
                        formulaCounts.getOrDefault(grille.getId(), 0L)
                ))
                .toList();
    }

    private void addUsage(Map<Long, LinkedHashMap<Long, Usage>> usagesByGrid, Long grilleId, Usage usage) {
        if (usage != null) {
            usagesByGrid.computeIfAbsent(grilleId, ignored -> new LinkedHashMap<>()).putIfAbsent(usage.getId(), usage);
        }
    }

    private boolean matches(GrilleTarifaire grille, List<Convention> conventions, String query) {
        if (query.isEmpty()) {
            return true;
        }
        if (normalize(grille.getLibelle()).contains(query)
                || normalize(grille.getDescription()).contains(query)
                || normalize(grille.getCompagnieAssurance().getCode()).contains(query)
                || normalize(grille.getCompagnieAssurance().getNom()).contains(query)) {
            return true;
        }
        return conventions.stream().anyMatch(convention -> normalize(convention.getCode()).contains(query)
                || normalize(convention.getIntitule()).contains(query));
    }

    private GrilleTarifaireCatalogueResponse toResponse(
            GrilleTarifaire grille,
            List<Convention> conventions,
            LinkedHashMap<Long, Usage> usages,
            long nombreLignes,
            long nombreFormulesPersonne
    ) {
        return GrilleTarifaireCatalogueResponse.builder()
                .id(grille.getId())
                .libelle(grille.getLibelle())
                .description(grille.getDescription())
                .actif(grille.getActif())
                .compagnieAssuranceId(grille.getCompagnieAssurance().getId())
                .compagnieAssuranceCode(grille.getCompagnieAssurance().getCode())
                .compagnieAssuranceLibelle(grille.getCompagnieAssurance().getNom())
                .conventions(conventions.stream()
                        .map(convention -> GrilleTarifaireCatalogueResponse.ReferenceSummary.builder()
                                .id(convention.getId())
                                .code(convention.getCode())
                                .libelle(convention.getIntitule())
                                .build())
                        .toList())
                .usages(usages.values().stream()
                        .sorted(Comparator.comparing(Usage::getCode))
                        .map(usage -> GrilleTarifaireCatalogueResponse.ReferenceSummary.builder()
                                .id(usage.getId())
                                .code(usage.getCode())
                                .libelle(usage.getLibelle())
                                .build())
                        .toList())
                .nombreLignes(nombreLignes)
                .nombreFormulesPersonne(nombreFormulesPersonne)
                .updatedAt(grille.getUpdatedAt())
                .build();
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }
}
