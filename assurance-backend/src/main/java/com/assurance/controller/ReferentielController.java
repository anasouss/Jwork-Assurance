package com.assurance.controller;

import com.assurance.dto.request.UpsertCategorieTransportRequest;
import com.assurance.dto.request.UpsertGrilleTarifaireRequest;
import com.assurance.dto.request.UpsertLigneGrilleTarifaireRequest;
import com.assurance.dto.response.ApiResponse;
import com.assurance.dto.response.ReferenceOptionResponse;
import com.assurance.entity.CategorieTransport;
import com.assurance.entity.CompagnieAssurance;
import com.assurance.entity.Convention;
import com.assurance.entity.Garantie;
import com.assurance.entity.GrilleTarifaire;
import com.assurance.entity.LigneGrilleTarifaire;
import com.assurance.entity.Usage;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.*;
import com.assurance.security.TenantContext;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/referentiel")
@RequiredArgsConstructor
public class ReferentielController {

    private final CategorieTransportRepository categorieTransportRepository;
    private final UsageRepository usageRepository;
    private final MarqueRepository marqueRepository;
    private final CarrosserieRepository carrosserieRepository;
    private final GarantieRepository garantieRepository;
    private final CompagnieAssuranceRepository compagnieAssuranceRepository;
    private final GrilleTarifaireRepository grilleTarifaireRepository;
    private final LigneGrilleTarifaireRepository ligneGrilleTarifaireRepository;
    private final VilleRepository villeRepository;
    private final CategorieClientRepository categorieClientRepository;
    private final GroupeUsageAttestationRepository groupeUsageAttestationRepository;
    private final ConventionRepository conventionRepository;

    @GetMapping("/usages")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> usages() {
        return ResponseEntity.ok(ApiResponse.success(usageRepository.findAll(Sort.by("code")).stream()
                .filter(usage -> Boolean.TRUE.equals(usage.getActif()))
                .map(usage -> option(usage.getId(), usage.getCode(), usage.getLibelle())
                        .putValue("byCarburantAndPf", usage.getByCarburantAndPf())
                        .putValue("bySousClasse", usage.getBySousClasse())
                        .putValue("byPtc", usage.getByPtc())
                        .putValue("byPrime", usage.getByPrime())
                        .putValue("byCategorieTransport", usage.getByCategorieTransport())
                        .putValue("consommeAttestation", usage.getConsommeAttestation())
                        .putValue("groupeUsageAttestationCode", usage.getGroupeUsageAttestation() != null ? usage.getGroupeUsageAttestation().getCode() : null)
                        .map())
                .toList()));
    }

    @GetMapping("/marques")
    public ResponseEntity<ApiResponse<List<ReferenceOptionResponse>>> marques() {
        return ResponseEntity.ok(ApiResponse.success(marqueRepository.findAll(Sort.by("libelle")).stream()
                .map(marque -> ReferenceOptionResponse.builder().id(marque.getId()).libelle(marque.getLibelle()).build())
                .toList()));
    }

    @GetMapping("/carrosseries")
    public ResponseEntity<ApiResponse<List<ReferenceOptionResponse>>> carrosseries() {
        return ResponseEntity.ok(ApiResponse.success(carrosserieRepository.findAll(Sort.by("libelle")).stream()
                .map(carrosserie -> ReferenceOptionResponse.builder().id(carrosserie.getId()).libelle(carrosserie.getLibelle()).build())
                .toList()));
    }

    @GetMapping("/compagnies-assurance")
    public ResponseEntity<ApiResponse<List<ReferenceOptionResponse>>> compagniesAssurance() {
        return ResponseEntity.ok(ApiResponse.success(compagnieAssuranceRepository.findAll(Sort.by("nom")).stream()
                .map(compagnie -> ReferenceOptionResponse.builder()
                        .id(compagnie.getId())
                        .code(compagnie.getCode())
                        .libelle(compagnie.getNom())
                        .actif(compagnie.getActif())
                        .build())
                .toList()));
    }

    @GetMapping("/grilles-tarifaires")
    public ResponseEntity<ApiResponse<List<ReferenceOptionResponse>>> grillesTarifaires() {
        return ResponseEntity.ok(ApiResponse.success(grilleTarifaireRepository.findAll(Sort.by(Sort.Direction.DESC, "createdAt")).stream()
                .filter(grille -> Boolean.TRUE.equals(grille.getActif()))
                .map(grille -> ReferenceOptionResponse.builder()
                        .id(grille.getId())
                        .libelle(grille.getLibelle())
                        .description(grille.getDescription())
                        .code(grille.getCompagnieAssurance() != null ? grille.getCompagnieAssurance().getCode() : null)
                        .compagnieAssuranceId(grille.getCompagnieAssurance() != null ? grille.getCompagnieAssurance().getId() : null)
                        .compagnieAssuranceLibelle(grille.getCompagnieAssurance() != null ? grille.getCompagnieAssurance().getNom() : null)
                        .actif(grille.getActif())
                        .build())
                .toList()));
    }

    @GetMapping("/conventions")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> conventions() {
        String agenceId = TenantContext.getCurrentAgence();
        return ResponseEntity.ok(ApiResponse.success(conventionRepository.findByAgenceIdAndActifTrueOrderByIntituleAsc(agenceId).stream()
                .map(convention -> option(convention.getId(), convention.getCode(), convention.getIntitule())
                        .putValue("description", convention.getDescription())
                        .putValue("compagnieAssuranceId", convention.getCompagnieAssurance() != null ? convention.getCompagnieAssurance().getId() : null)
                        .putValue("compagnieAssuranceLibelle", convention.getCompagnieAssurance() != null ? convention.getCompagnieAssurance().getNom() : null)
                        .putValue("organismeConventionne", convention.getOrganismeConventionne())
                        .putValue("dateEffet", convention.getDateEffet())
                        .putValue("dateEcheance", convention.getDateEcheance())
                        .putValue("typeEcheance", convention.getTypeEcheance())
                        .putValue("echeance", convention.getEcheance())
                        .putValue("fractionnement", convention.getFractionnement())
                        .map())
                .toList()));
    }

    @PostMapping("/grilles-tarifaires")
    public ResponseEntity<ApiResponse<ReferenceOptionResponse>> createGrilleTarifaire(
            @Valid @RequestBody UpsertGrilleTarifaireRequest request
    ) {
        CompagnieAssurance compagnie = compagnieAssuranceRepository.findById(request.getCompagnieAssuranceId())
                .orElseThrow(() -> new ResourceNotFoundException("CompagnieAssurance", request.getCompagnieAssuranceId()));
        GrilleTarifaire grille = grilleTarifaireRepository.save(GrilleTarifaire.builder()
                .agence(null)
                .compagnieAssurance(compagnie)
                .libelle(request.getLibelle())
                .description(request.getDescription())
                .actif(request.getActif() == null ? true : request.getActif())
                .build());
        return ResponseEntity.ok(ApiResponse.success(toGrilleResponse(grille), "Grille tarifaire creee"));
    }

    @PutMapping("/grilles-tarifaires/{id}")
    public ResponseEntity<ApiResponse<ReferenceOptionResponse>> updateGrilleTarifaire(
            @PathVariable String id,
            @Valid @RequestBody UpsertGrilleTarifaireRequest request
    ) {
        GrilleTarifaire grille = grilleTarifaireRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("GrilleTarifaire", id));
        CompagnieAssurance compagnie = compagnieAssuranceRepository.findById(request.getCompagnieAssuranceId())
                .orElseThrow(() -> new ResourceNotFoundException("CompagnieAssurance", request.getCompagnieAssuranceId()));
        grille.setCompagnieAssurance(compagnie);
        grille.setLibelle(request.getLibelle());
        grille.setDescription(request.getDescription());
        grille.setActif(request.getActif() == null ? true : request.getActif());
        return ResponseEntity.ok(ApiResponse.success(toGrilleResponse(grilleTarifaireRepository.save(grille)), "Grille tarifaire modifiee"));
    }

    @GetMapping("/garanties")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> garanties() {
        return ResponseEntity.ok(ApiResponse.success(garantieRepository.findAll(Sort.by("ordreAffichage", "code")).stream()
                .filter(garantie -> Boolean.TRUE.equals(garantie.getActif()))
                .map(garantie -> option(garantie.getId(), garantie.getCode(), garantie.getLibelle())
                        .putValue("typeGarantie", garantie.getTypeGarantie())
                        .putValue("obligatoire", garantie.getObligatoire())
                        .putValue("responsabiliteCivile", garantie.getResponsabiliteCivile())
                        .putValue("requiertValeurVenale", garantie.getRequiertValeurVenale())
                        .putValue("requiertValeurNeuf", garantie.getRequiertValeurNeuf())
                        .putValue("requiertValeurGlace", garantie.getRequiertValeurGlace())
                        .putValue("avecFranchise", garantie.getAvecFranchise())
                        .putValue("avecCapital", garantie.getAvecCapital())
                        .putValue("modeParDefaut", garantie.getModeParDefaut())
                        .putValue("sourceValeurParDefaut", garantie.getSourceValeurParDefaut())
                        .putValue("saisieManuelleAutorisee", garantie.getSaisieManuelleAutorisee())
                        .map())
                .toList()));
    }

    @GetMapping("/lignes-grille-tarifaire")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> lignesGrilleTarifaire(
            @RequestParam String grilleId,
            @RequestParam(required = false) String usageId,
            @RequestParam(required = false) String garantieId
    ) {
        if (grilleId == null || grilleId.isBlank()) {
            throw new BadRequestException("La grille tarifaire est obligatoire");
        }
        return ResponseEntity.ok(ApiResponse.success(ligneGrilleTarifaireRepository.findByGrilleTarifaireIdAndActifTrue(grilleId).stream()
                .filter(ligne -> usageId == null || usageId.isBlank() || ligne.getUsage() == null || ligne.getUsage().getId().equals(usageId))
                .filter(ligne -> garantieId == null || garantieId.isBlank() || ligne.getGarantie().getId().equals(garantieId))
                .map(ligne -> option(ligne.getId(), null, ligne.getLibelleOption() != null ? ligne.getLibelleOption() : ligne.getGarantie().getLibelle())
                        .putValue("garantieId", ligne.getGarantie().getId())
                        .putValue("usageId", ligne.getUsage() != null ? ligne.getUsage().getId() : null)
                        .putValue("categorieTransportId", ligne.getCategorieTransport() != null ? ligne.getCategorieTransport().getId() : null)
                        .putValue("modeTarification", ligne.getModeTarification())
                        .putValue("prime", ligne.getPrime())
                        .putValue("capital", ligne.getCapital())
                        .putValue("taux", ligne.getTaux())
                        .putValue("tauxFranchise", ligne.getTauxFranchise())
                        .putValue("franchiseMinimale", ligne.getFranchiseMinimale())
                        .map())
                .toList()));
    }

    @PostMapping("/grilles-tarifaires/{grilleId}/lignes")
    public ResponseEntity<ApiResponse<Map<String, Object>>> createLigneGrilleTarifaire(
            @PathVariable String grilleId,
            @Valid @RequestBody UpsertLigneGrilleTarifaireRequest request
    ) {
        GrilleTarifaire grille = grilleTarifaireRepository.findById(grilleId)
                .orElseThrow(() -> new ResourceNotFoundException("GrilleTarifaire", grilleId));
        LigneGrilleTarifaire ligne = new LigneGrilleTarifaire();
        ligne.setGrilleTarifaire(grille);
        applyLigneRequest(ligne, request);
        return ResponseEntity.ok(ApiResponse.success(toLigneResponse(ligneGrilleTarifaireRepository.save(ligne)), "Ligne de grille creee"));
    }

    @PutMapping("/lignes-grille-tarifaire/{id}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> updateLigneGrilleTarifaire(
            @PathVariable String id,
            @Valid @RequestBody UpsertLigneGrilleTarifaireRequest request
    ) {
        LigneGrilleTarifaire ligne = ligneGrilleTarifaireRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("LigneGrilleTarifaire", id));
        applyLigneRequest(ligne, request);
        return ResponseEntity.ok(ApiResponse.success(toLigneResponse(ligneGrilleTarifaireRepository.save(ligne)), "Ligne de grille modifiee"));
    }

    @GetMapping("/villes")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> villes() {
        return ResponseEntity.ok(ApiResponse.success(villeRepository.findAll(Sort.by("nom")).stream()
                .map(ville -> option(ville.getId(), null, ville.getNom())
                        .putValue("saharienne", ville.getSaharienne())
                        .map())
                .toList()));
    }

    @GetMapping("/categories-client")
    public ResponseEntity<ApiResponse<List<ReferenceOptionResponse>>> categoriesClient() {
        return ResponseEntity.ok(ApiResponse.success(categorieClientRepository.findAll(Sort.by("libelle")).stream()
                .map(categorie -> ReferenceOptionResponse.builder()
                        .id(categorie.getId())
                        .code(categorie.getCode())
                        .libelle(categorie.getLibelle())
                        .actif(categorie.getActif())
                        .build())
                .toList()));
    }

    @GetMapping("/groupes-usage-attestation")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> groupesUsageAttestation() {
        return ResponseEntity.ok(ApiResponse.success(groupeUsageAttestationRepository.findAll(Sort.by("code")).stream()
                .filter(groupe -> Boolean.TRUE.equals(groupe.getActif()) && Boolean.TRUE.equals(groupe.getVisibleStock()))
                .map(groupe -> option(groupe.getId(), groupe.getCode(), groupe.getLibelle())
                        .putValue("couleur", groupe.getCouleur())
                        .putValue("restrictionCompagnie", groupe.getRestrictionCompagnie())
                        .map())
                .toList()));
    }

    @GetMapping("/categories-transport")
    public ResponseEntity<ApiResponse<List<ReferenceOptionResponse>>> categoriesTransport() {
        List<ReferenceOptionResponse> categories = categorieTransportRepository.findByActifTrueOrderByLibelleAsc().stream()
                .map(this::toResponse)
                .toList();
        return ResponseEntity.ok(ApiResponse.success(categories));
    }

    @PostMapping("/categories-transport")
    public ResponseEntity<ApiResponse<ReferenceOptionResponse>> createCategorieTransport(
            @Valid @RequestBody UpsertCategorieTransportRequest request
    ) {
        categorieTransportRepository.findByCodeIgnoreCase(request.getCode()).ifPresent(existing -> {
            throw new BadRequestException("Code categorie transport deja utilise");
        });
        CategorieTransport categorie = categorieTransportRepository.save(CategorieTransport.builder()
                .code(request.getCode())
                .libelle(request.getLibelle())
                .description(request.getDescription())
                .actif(request.getActif() == null ? true : request.getActif())
                .build());
        return ResponseEntity.ok(ApiResponse.success(toResponse(categorie), "Categorie transport creee"));
    }

    @PutMapping("/categories-transport/{id}")
    public ResponseEntity<ApiResponse<ReferenceOptionResponse>> updateCategorieTransport(
            @PathVariable String id,
            @Valid @RequestBody UpsertCategorieTransportRequest request
    ) {
        CategorieTransport categorie = categorieTransportRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("CategorieTransport", id));
        categorieTransportRepository.findByCodeIgnoreCase(request.getCode())
                .filter(existing -> !existing.getId().equals(id))
                .ifPresent(existing -> {
                    throw new BadRequestException("Code categorie transport deja utilise");
                });
        categorie.setCode(request.getCode());
        categorie.setLibelle(request.getLibelle());
        categorie.setDescription(request.getDescription());
        categorie.setActif(request.getActif() == null ? true : request.getActif());
        return ResponseEntity.ok(ApiResponse.success(toResponse(categorieTransportRepository.save(categorie)), "Categorie transport modifiee"));
    }

    private ReferenceOptionResponse toResponse(CategorieTransport categorie) {
        return ReferenceOptionResponse.builder()
                .id(categorie.getId())
                .code(categorie.getCode())
                .libelle(categorie.getLibelle())
                .description(categorie.getDescription())
                .actif(categorie.getActif())
                .build();
    }

    private ReferenceOptionResponse toGrilleResponse(GrilleTarifaire grille) {
        return ReferenceOptionResponse.builder()
                .id(grille.getId())
                .code(grille.getCompagnieAssurance() != null ? grille.getCompagnieAssurance().getCode() : null)
                .libelle(grille.getLibelle())
                .description(grille.getDescription())
                .compagnieAssuranceId(grille.getCompagnieAssurance() != null ? grille.getCompagnieAssurance().getId() : null)
                .compagnieAssuranceLibelle(grille.getCompagnieAssurance() != null ? grille.getCompagnieAssurance().getNom() : null)
                .actif(grille.getActif())
                .build();
    }

    private void applyLigneRequest(LigneGrilleTarifaire ligne, UpsertLigneGrilleTarifaireRequest request) {
        Garantie garantie = garantieRepository.findById(request.getGarantieId())
                .orElseThrow(() -> new ResourceNotFoundException("Garantie", request.getGarantieId()));
        Usage usage = request.getUsageId() == null || request.getUsageId().isBlank() ? null :
                usageRepository.findById(request.getUsageId())
                        .orElseThrow(() -> new ResourceNotFoundException("Usage", request.getUsageId()));
        CategorieTransport categorieTransport = request.getCategorieTransportId() == null || request.getCategorieTransportId().isBlank() ? null :
                categorieTransportRepository.findById(request.getCategorieTransportId())
                        .orElseThrow(() -> new ResourceNotFoundException("CategorieTransport", request.getCategorieTransportId()));
        ligne.setGarantie(garantie);
        ligne.setUsage(usage);
        ligne.setCategorieTransport(categorieTransport);
        ligne.setPuissanceFiscaleMin(request.getPuissanceFiscaleMin());
        ligne.setPuissanceFiscaleMax(request.getPuissanceFiscaleMax());
        ligne.setNombrePlacesMin(request.getNombrePlacesMin());
        ligne.setNombrePlacesMax(request.getNombrePlacesMax());
        ligne.setPtcMin(request.getPtcMin());
        ligne.setPtcMax(request.getPtcMax());
        ligne.setSousClasse(request.getSousClasse());
        ligne.setCarburant(request.getCarburant());
        ligne.setTaux(request.getTaux());
        ligne.setTauxFranchise(request.getTauxFranchise());
        ligne.setFranchiseMinimale(request.getFranchiseMinimale());
        ligne.setTauxRemorque(request.getTauxRemorque());
        ligne.setTauxFranchiseRemorque(request.getTauxFranchiseRemorque());
        ligne.setFranchiseMinimaleRemorque(request.getFranchiseMinimaleRemorque());
        ligne.setPrime(request.getPrime());
        ligne.setCapital(request.getCapital());
        ligne.setLibelleOption(request.getLibelleOption());
        ligne.setOrdreAffichage(request.getOrdreAffichage());
        ligne.setModeTarification(request.getModeTarification());
        ligne.setActif(request.getActif() == null ? true : request.getActif());
    }

    private Map<String, Object> toLigneResponse(LigneGrilleTarifaire ligne) {
        return option(ligne.getId(), null, ligne.getLibelleOption() != null ? ligne.getLibelleOption() : ligne.getGarantie().getLibelle())
                .putValue("grilleId", ligne.getGrilleTarifaire() != null ? ligne.getGrilleTarifaire().getId() : null)
                .putValue("garantieId", ligne.getGarantie() != null ? ligne.getGarantie().getId() : null)
                .putValue("usageId", ligne.getUsage() != null ? ligne.getUsage().getId() : null)
                .putValue("categorieTransportId", ligne.getCategorieTransport() != null ? ligne.getCategorieTransport().getId() : null)
                .putValue("modeTarification", ligne.getModeTarification())
                .putValue("prime", ligne.getPrime())
                .putValue("capital", ligne.getCapital())
                .putValue("taux", ligne.getTaux())
                .putValue("tauxFranchise", ligne.getTauxFranchise())
                .putValue("franchiseMinimale", ligne.getFranchiseMinimale())
                .putValue("actif", ligne.getActif())
                .map();
    }

    private OptionMap option(String id, String code, String libelle) {
        return new OptionMap()
                .putValue("id", id)
                .putValue("code", code)
                .putValue("libelle", libelle);
    }

    private static final class OptionMap {
        private final Map<String, Object> values = new LinkedHashMap<>();

        private OptionMap putValue(String key, Object value) {
            values.put(key, value);
            return this;
        }

        private Map<String, Object> map() {
            return values;
        }
    }
}
