package com.assurance.controller;

import com.assurance.dto.request.BulkUpdateTarifUsageRequest;
import com.assurance.dto.request.UpsertCategorieTransportRequest;
import com.assurance.dto.request.UpsertCodeReferenceRequest;
import com.assurance.dto.request.UpsertCompagnieAssuranceRequest;
import com.assurance.dto.request.UpsertConventionRequest;
import com.assurance.dto.request.UpsertFormuleGarantiePersonneRequest;
import com.assurance.dto.request.UpsertGrilleTarifaireRequest;
import com.assurance.dto.request.UpsertGrilleUsageConfigurationRequest;
import com.assurance.dto.request.UpsertLigneGrilleTarifaireRequest;
import com.assurance.dto.request.UpsertReferenceRequest;
import com.assurance.dto.request.UpsertTarifUsageRequest;
import com.assurance.dto.request.UpsertUsageRequest;
import com.assurance.dto.response.ApiResponse;
import com.assurance.dto.response.ReferenceOptionResponse;
import com.assurance.entity.CategorieClient;
import com.assurance.entity.CategorieTransport;
import com.assurance.entity.Carburant;
import com.assurance.entity.Carrosserie;
import com.assurance.entity.CompagnieAssistance;
import com.assurance.entity.CompagnieAssurance;
import com.assurance.entity.Convention;
import com.assurance.entity.Agence;
import com.assurance.entity.FormuleGarantiePersonne;
import com.assurance.entity.Garantie;
import com.assurance.entity.GrilleTarifaire;
import com.assurance.entity.GroupeUsageAttestation;
import com.assurance.entity.LigneGrilleTarifaire;
import com.assurance.entity.Marque;
import com.assurance.entity.ProduitAssistance;
import com.assurance.entity.SousClasse;
import com.assurance.entity.TarifProduitAssistance;
import com.assurance.entity.TarifUsage;
import com.assurance.entity.Usage;
import com.assurance.enums.TypeEcheanceConvention;
import com.assurance.enums.TypeGarantie;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.*;
import com.assurance.security.TenantContext;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/v1/referentiel")
@RequiredArgsConstructor
public class ReferentielController {

    private final CategorieTransportRepository categorieTransportRepository;
    private final UsageRepository usageRepository;
    private final MarqueRepository marqueRepository;
    private final CarrosserieRepository carrosserieRepository;
    private final CarburantRepository carburantRepository;
    private final SousClasseRepository sousClasseRepository;
    private final GarantieRepository garantieRepository;
    private final CompagnieAssuranceRepository compagnieAssuranceRepository;
    private final GrilleTarifaireRepository grilleTarifaireRepository;
    private final LigneGrilleTarifaireRepository ligneGrilleTarifaireRepository;
    private final FormuleGarantiePersonneRepository formuleGarantiePersonneRepository;
    private final TarifUsageRepository tarifUsageRepository;
    private final VilleRepository villeRepository;
    private final CategorieClientRepository categorieClientRepository;
    private final GroupeUsageAttestationRepository groupeUsageAttestationRepository;
    private final ConventionRepository conventionRepository;
    private final CompagnieAssistanceRepository compagnieAssistanceRepository;
    private final ProduitAssistanceRepository produitAssistanceRepository;
    private final AgenceRepository agenceRepository;

    @GetMapping("/usages")
    @Transactional(readOnly = true)
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> usages() {
        return ResponseEntity.ok(ApiResponse.success(usageRepository.findAll(Sort.by("code")).stream()
                .filter(usage -> Boolean.TRUE.equals(usage.getActif()))
                .map(usage -> option(usage.getId(), usage.getCode(), usage.getLibelle())
                        .putValue("byCarburantAndPf", usage.getByCarburantAndPf())
                        .putValue("bySousClasse", usage.getBySousClasse())
                        .putValue("byPtc", usage.getByPtc())
                        .putValue("byPrime", usage.getByPrime())
                        .putValue("byCategorieTransport", usage.getByCategorieTransport())
                        .putValue("garantiesPersonne", Boolean.TRUE.equals(usage.getGarantiesPersonne()))
                        .putValue("consommeAttestation", usage.getConsommeAttestation())
                        .putValue("groupeUsageAttestationId", usage.getGroupeUsageAttestation() != null ? usage.getGroupeUsageAttestation().getId() : null)
                        .putValue("groupeUsageAttestationCode", usage.getGroupeUsageAttestation() != null ? usage.getGroupeUsageAttestation().getCode() : null)
                        .map())
                .toList()));
    }

    @PostMapping("/usages")
    public ResponseEntity<ApiResponse<Map<String, Object>>> createUsage(@Valid @RequestBody UpsertUsageRequest request) {
        usageRepository.findByCodeIgnoreCase(request.getCode()).ifPresent(existing -> {
            throw new BadRequestException("Code usage deja utilise");
        });
        Usage usage = new Usage();
        applyUsageRequest(usage, request);
        return ResponseEntity.ok(ApiResponse.success(toUsageResponse(usageRepository.save(usage)), "Usage cree"));
    }

    @PutMapping("/usages/{id}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> updateUsage(
            @PathVariable String id,
            @Valid @RequestBody UpsertUsageRequest request
    ) {
        Usage usage = usageRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Usage", id));
        usageRepository.findByCodeIgnoreCase(request.getCode())
                .filter(existing -> !existing.getId().equals(id))
                .ifPresent(existing -> {
                    throw new BadRequestException("Code usage deja utilise");
                });
        applyUsageRequest(usage, request);
        return ResponseEntity.ok(ApiResponse.success(toUsageResponse(usageRepository.save(usage)), "Usage modifie"));
    }

    @GetMapping("/marques")
    public ResponseEntity<ApiResponse<List<ReferenceOptionResponse>>> marques() {
        return ResponseEntity.ok(ApiResponse.success(marqueRepository.findAll(Sort.by("libelle")).stream()
                .map(marque -> ReferenceOptionResponse.builder().id(marque.getId()).libelle(marque.getLibelle()).actif(marque.getActif()).build())
                .toList()));
    }

    @PostMapping("/marques")
    public ResponseEntity<ApiResponse<ReferenceOptionResponse>> createMarque(@Valid @RequestBody UpsertReferenceRequest request) {
        marqueRepository.findByLibelleIgnoreCase(request.getLibelle()).ifPresent(existing -> {
            throw new BadRequestException("Marque deja existante");
        });
        Marque marque = marqueRepository.save(Marque.builder()
                .libelle(request.getLibelle())
                .actif(request.getActif() == null ? true : request.getActif())
                .build());
        return ResponseEntity.ok(ApiResponse.success(toResponse(marque), "Marque creee"));
    }

    @PutMapping("/marques/{id}")
    public ResponseEntity<ApiResponse<ReferenceOptionResponse>> updateMarque(
            @PathVariable String id,
            @Valid @RequestBody UpsertReferenceRequest request
    ) {
        Marque marque = marqueRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Marque", id));
        marqueRepository.findByLibelleIgnoreCase(request.getLibelle())
                .filter(existing -> !existing.getId().equals(id))
                .ifPresent(existing -> {
                    throw new BadRequestException("Marque deja existante");
                });
        marque.setLibelle(request.getLibelle());
        marque.setActif(request.getActif() == null ? true : request.getActif());
        return ResponseEntity.ok(ApiResponse.success(toResponse(marqueRepository.save(marque)), "Marque modifiee"));
    }

    @GetMapping("/carrosseries")
    public ResponseEntity<ApiResponse<List<ReferenceOptionResponse>>> carrosseries() {
        return ResponseEntity.ok(ApiResponse.success(carrosserieRepository.findAll(Sort.by("libelle")).stream()
                .map(carrosserie -> ReferenceOptionResponse.builder().id(carrosserie.getId()).libelle(carrosserie.getLibelle()).actif(carrosserie.getActif()).build())
                .toList()));
    }

    @PostMapping("/carrosseries")
    public ResponseEntity<ApiResponse<ReferenceOptionResponse>> createCarrosserie(@Valid @RequestBody UpsertReferenceRequest request) {
        carrosserieRepository.findByLibelleIgnoreCase(request.getLibelle()).ifPresent(existing -> {
            throw new BadRequestException("Carrosserie deja existante");
        });
        Carrosserie carrosserie = carrosserieRepository.save(Carrosserie.builder()
                .libelle(request.getLibelle())
                .actif(request.getActif() == null ? true : request.getActif())
                .build());
        return ResponseEntity.ok(ApiResponse.success(toResponse(carrosserie), "Carrosserie creee"));
    }

    @PutMapping("/carrosseries/{id}")
    public ResponseEntity<ApiResponse<ReferenceOptionResponse>> updateCarrosserie(
            @PathVariable String id,
            @Valid @RequestBody UpsertReferenceRequest request
    ) {
        Carrosserie carrosserie = carrosserieRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Carrosserie", id));
        carrosserieRepository.findByLibelleIgnoreCase(request.getLibelle())
                .filter(existing -> !existing.getId().equals(id))
                .ifPresent(existing -> {
                    throw new BadRequestException("Carrosserie deja existante");
                });
        carrosserie.setLibelle(request.getLibelle());
        carrosserie.setActif(request.getActif() == null ? true : request.getActif());
        return ResponseEntity.ok(ApiResponse.success(toResponse(carrosserieRepository.save(carrosserie)), "Carrosserie modifiee"));
    }

    @GetMapping("/carburants")
    public ResponseEntity<ApiResponse<List<ReferenceOptionResponse>>> carburants() {
        return ResponseEntity.ok(ApiResponse.success(carburantRepository.findAll(Sort.by("code")).stream()
                .map(this::toResponse)
                .toList()));
    }

    @PostMapping("/carburants")
    public ResponseEntity<ApiResponse<ReferenceOptionResponse>> createCarburant(@Valid @RequestBody UpsertCodeReferenceRequest request) {
        carburantRepository.findByCodeIgnoreCase(request.getCode()).ifPresent(existing -> {
            throw new BadRequestException("Code carburant deja utilise");
        });
        Carburant carburant = carburantRepository.save(Carburant.builder()
                .code(request.getCode())
                .libelle(request.getLibelle())
                .actif(request.getActif() == null ? true : request.getActif())
                .build());
        return ResponseEntity.ok(ApiResponse.success(toResponse(carburant), "Carburant cree"));
    }

    @PutMapping("/carburants/{id}")
    public ResponseEntity<ApiResponse<ReferenceOptionResponse>> updateCarburant(
            @PathVariable String id,
            @Valid @RequestBody UpsertCodeReferenceRequest request
    ) {
        Carburant carburant = carburantRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Carburant", id));
        carburantRepository.findByCodeIgnoreCase(request.getCode())
                .filter(existing -> !existing.getId().equals(id))
                .ifPresent(existing -> {
                    throw new BadRequestException("Code carburant deja utilise");
                });
        carburant.setCode(request.getCode());
        carburant.setLibelle(request.getLibelle());
        carburant.setActif(request.getActif() == null ? true : request.getActif());
        return ResponseEntity.ok(ApiResponse.success(toResponse(carburantRepository.save(carburant)), "Carburant modifie"));
    }

    @GetMapping("/sous-classes")
    public ResponseEntity<ApiResponse<List<ReferenceOptionResponse>>> sousClasses() {
        return ResponseEntity.ok(ApiResponse.success(sousClasseRepository.findAll(Sort.by("code")).stream()
                .map(this::toResponse)
                .toList()));
    }

    @PostMapping("/sous-classes")
    public ResponseEntity<ApiResponse<ReferenceOptionResponse>> createSousClasse(@Valid @RequestBody UpsertCodeReferenceRequest request) {
        sousClasseRepository.findByCodeIgnoreCase(request.getCode()).ifPresent(existing -> {
            throw new BadRequestException("Code sous-classe deja utilise");
        });
        SousClasse sousClasse = sousClasseRepository.save(SousClasse.builder()
                .code(request.getCode())
                .libelle(request.getLibelle())
                .actif(request.getActif() == null ? true : request.getActif())
                .build());
        return ResponseEntity.ok(ApiResponse.success(toResponse(sousClasse), "Sous-classe creee"));
    }

    @PutMapping("/sous-classes/{id}")
    public ResponseEntity<ApiResponse<ReferenceOptionResponse>> updateSousClasse(
            @PathVariable String id,
            @Valid @RequestBody UpsertCodeReferenceRequest request
    ) {
        SousClasse sousClasse = sousClasseRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("SousClasse", id));
        sousClasseRepository.findByCodeIgnoreCase(request.getCode())
                .filter(existing -> !existing.getId().equals(id))
                .ifPresent(existing -> {
                    throw new BadRequestException("Code sous-classe deja utilise");
                });
        sousClasse.setCode(request.getCode());
        sousClasse.setLibelle(request.getLibelle());
        sousClasse.setActif(request.getActif() == null ? true : request.getActif());
        return ResponseEntity.ok(ApiResponse.success(toResponse(sousClasseRepository.save(sousClasse)), "Sous-classe modifiee"));
    }

    @GetMapping("/compagnies-assurance")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> compagniesAssurance() {
        return ResponseEntity.ok(ApiResponse.success(compagnieAssuranceRepository.findAll(Sort.by("ordreAffichage").ascending().and(Sort.by("nom").ascending())).stream()
                .map(this::toCompagnieAssuranceResponse)
                .toList()));
    }

    @PostMapping("/compagnies-assurance")
    public ResponseEntity<ApiResponse<Map<String, Object>>> createCompagnieAssurance(
            @Valid @RequestBody UpsertCompagnieAssuranceRequest request
    ) {
        compagnieAssuranceRepository.findByCode(request.getCode()).ifPresent(existing -> {
            throw new BadRequestException("Code compagnie deja utilise");
        });
        CompagnieAssurance compagnie = new CompagnieAssurance();
        applyCompagnieAssuranceRequest(compagnie, request);
        return ResponseEntity.ok(ApiResponse.success(
                toCompagnieAssuranceResponse(compagnieAssuranceRepository.save(compagnie)),
                "Compagnie creee"
        ));
    }

    @PutMapping("/compagnies-assurance/{id}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> updateCompagnieAssurance(
            @PathVariable String id,
            @Valid @RequestBody UpsertCompagnieAssuranceRequest request
    ) {
        CompagnieAssurance compagnie = compagnieAssuranceRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("CompagnieAssurance", id));
        compagnieAssuranceRepository.findByCode(request.getCode())
                .filter(existing -> !existing.getId().equals(id))
                .ifPresent(existing -> {
                    throw new BadRequestException("Code compagnie deja utilise");
                });
        applyCompagnieAssuranceRequest(compagnie, request);
        return ResponseEntity.ok(ApiResponse.success(
                toCompagnieAssuranceResponse(compagnieAssuranceRepository.save(compagnie)),
                "Compagnie modifiee"
        ));
    }

    @GetMapping("/compagnies-assistance")
    public ResponseEntity<ApiResponse<List<ReferenceOptionResponse>>> compagniesAssistance() {
        return ResponseEntity.ok(ApiResponse.success(compagnieAssistanceRepository.findAll(Sort.by("nom")).stream()
                .filter(compagnie -> Boolean.TRUE.equals(compagnie.getActif()))
                .map(compagnie -> ReferenceOptionResponse.builder()
                        .id(compagnie.getId())
                        .code(compagnie.getCode())
                        .libelle(compagnie.getNom())
                        .actif(compagnie.getActif())
                        .build())
                .toList()));
    }

    @GetMapping("/produits-assistance")
    @Transactional(readOnly = true)
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> produitsAssistance(
            @RequestParam(required = false) String compagnieAssistanceId
    ) {
        return ResponseEntity.ok(ApiResponse.success(produitAssistanceRepository.findAll(Sort.by("libelle")).stream()
                .filter(produit -> Boolean.TRUE.equals(produit.getActif()))
                .filter(produit -> compagnieAssistanceId == null
                        || compagnieAssistanceId.isBlank()
                        || (produit.getCompagnieAssistance() != null
                        && produit.getCompagnieAssistance().getId().equals(compagnieAssistanceId)))
                .map(this::toProduitAssistanceResponse)
                .toList()));
    }

    @GetMapping("/grilles-tarifaires")
    @Transactional(readOnly = true)
    public ResponseEntity<ApiResponse<List<ReferenceOptionResponse>>> grillesTarifaires(
            @RequestParam(required = false) String compagnieAssuranceId
    ) {
        List<GrilleTarifaire> grilles = compagnieAssuranceId == null || compagnieAssuranceId.isBlank()
                ? grilleTarifaireRepository.findAllByOrderByCreatedAtDesc()
                : grilleTarifaireRepository.findByCompagnieAssuranceIdAndActifTrueOrderByLibelleAsc(compagnieAssuranceId);
        return ResponseEntity.ok(ApiResponse.success(grilles.stream()
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

    @GetMapping("/tarifs-usage")
    @Transactional(readOnly = true)
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> tarifsUsage() {
        return ResponseEntity.ok(ApiResponse.success(tarifUsageRepository.findAll().stream()
                .filter(tarif -> Boolean.TRUE.equals(tarif.getActif()))
                .sorted(Comparator
                        .comparing((TarifUsage tarif) -> tarif.getUsage() != null ? tarif.getUsage().getCode() : "")
                        .thenComparing(TarifUsage::getPuissanceFiscaleMin, Comparator.nullsLast(Comparator.naturalOrder())))
                .map(this::toTarifUsageResponse)
                .toList()));
    }

    @PostMapping("/tarifs-usage")
    public ResponseEntity<ApiResponse<Map<String, Object>>> createTarifUsage(@Valid @RequestBody UpsertTarifUsageRequest request) {
        TarifUsage tarif = new TarifUsage();
        applyTarifUsageRequest(tarif, request);
        return ResponseEntity.ok(ApiResponse.success(toTarifUsageResponse(tarifUsageRepository.save(tarif)), "Tarif usage cree"));
    }

    @PutMapping("/tarifs-usage/{id}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> updateTarifUsage(
            @PathVariable String id,
            @Valid @RequestBody UpsertTarifUsageRequest request
    ) {
        TarifUsage tarif = tarifUsageRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("TarifUsage", id));
        applyTarifUsageRequest(tarif, request);
        return ResponseEntity.ok(ApiResponse.success(toTarifUsageResponse(tarifUsageRepository.save(tarif)), "Tarif usage modifie"));
    }

    @DeleteMapping("/tarifs-usage/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteTarifUsage(@PathVariable String id) {
        TarifUsage tarif = tarifUsageRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("TarifUsage", id));
        tarif.setActif(false);
        tarifUsageRepository.save(tarif);
        return ResponseEntity.ok(ApiResponse.success((Void) null, "Tarif usage supprime"));
    }

    @PostMapping("/tarifs-usage/bulk-prime-nette")
    public ResponseEntity<ApiResponse<Map<String, Object>>> bulkUpdatePrimeNette(
            @Valid @RequestBody BulkUpdateTarifUsageRequest request
    ) {
        String adjustmentType = request.getAdjustmentType().trim().toUpperCase();
        String direction = request.getDirection().trim().toUpperCase();
        if (!"PERCENT".equals(adjustmentType) && !"FIXED".equals(adjustmentType)) {
            throw new BadRequestException("Type d'ajustement non supporte");
        }
        if (!"INCREASE".equals(direction) && !"DECREASE".equals(direction)) {
            throw new BadRequestException("Sens d'ajustement non supporte");
        }

        List<TarifUsage> targetTarifs = resolveBulkTarifTargets(request);
        targetTarifs.forEach(tarif -> tarif.setPrimeNette(adjustPrimeNette(
                tarif.getPrimeNette(),
                adjustmentType,
                direction,
                request.getValue()
        )));
        tarifUsageRepository.saveAll(targetTarifs);

        return ResponseEntity.ok(ApiResponse.success(Map.of("updatedRows", targetTarifs.size()), "Primes nettes mises a jour"));
    }

    @GetMapping("/conventions")
    @Transactional(readOnly = true)
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> conventions(
            @RequestParam(required = false) String compagnieAssuranceId
    ) {
        String agenceId = TenantContext.getCurrentAgence();
        List<Convention> conventions = compagnieAssuranceId == null || compagnieAssuranceId.isBlank()
                ? conventionRepository.findByAgenceIdAndActifTrueOrderByIntituleAsc(agenceId)
                : conventionRepository.findByAgenceIdAndCompagnieAssuranceIdAndActifTrueOrderByIntituleAsc(agenceId, compagnieAssuranceId);
        return ResponseEntity.ok(ApiResponse.success(conventions.stream()
                .map(this::toConventionResponse)
                .toList()));
    }

    @PostMapping("/conventions")
    @Transactional
    public ResponseEntity<ApiResponse<Map<String, Object>>> createConvention(@Valid @RequestBody UpsertConventionRequest request) {
        Convention convention = new Convention();
        applyConventionRequest(convention, request);
        return ResponseEntity.ok(ApiResponse.success(toConventionResponse(conventionRepository.save(convention)), "Convention creee"));
    }

    @PutMapping("/conventions/{id}")
    @Transactional
    public ResponseEntity<ApiResponse<Map<String, Object>>> updateConvention(
            @PathVariable String id,
            @Valid @RequestBody UpsertConventionRequest request
    ) {
        String agenceId = TenantContext.getCurrentAgence();
        Convention convention = conventionRepository.findByAgenceIdAndId(agenceId, id)
                .orElseThrow(() -> new ResourceNotFoundException("Convention", id));
        applyConventionRequest(convention, request);
        return ResponseEntity.ok(ApiResponse.success(toConventionResponse(conventionRepository.save(convention)), "Convention modifiee"));
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
                        .putValue("modesAutorises", garantie.getModesAutorises())
                        .putValue("sourceValeurParDefaut", garantie.getSourceValeurParDefaut())
                        .putValue("sourcesValeurAutorisees", garantie.getSourcesValeurAutorisees())
                        .putValue("saisieManuelleAutorisee", garantie.getSaisieManuelleAutorisee())
                        .map())
                .toList()));
    }

    @GetMapping("/lignes-grille-tarifaire")
    @Transactional(readOnly = true)
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
                        .putValue("garantieCode", ligne.getGarantie().getCode())
                        .putValue("garantieLibelle", ligne.getGarantie().getLibelle())
                        .putValue("usageId", ligne.getUsage() != null ? ligne.getUsage().getId() : null)
                        .putValue("categorieTransportId", ligne.getCategorieTransport() != null ? ligne.getCategorieTransport().getId() : null)
                        .putValue("modeTarification", ligne.getModeTarification())
                        .putValue("puissanceFiscaleMin", ligne.getPuissanceFiscaleMin())
                        .putValue("puissanceFiscaleMax", ligne.getPuissanceFiscaleMax())
                        .putValue("nombrePlacesMin", ligne.getNombrePlacesMin())
                        .putValue("nombrePlacesMax", ligne.getNombrePlacesMax())
                        .putValue("ptcMin", ligne.getPtcMin())
                        .putValue("ptcMax", ligne.getPtcMax())
                        .putValue("sousClasse", ligne.getSousClasse())
                        .putValue("carburant", ligne.getCarburant())
                        .putValue("prime", ligne.getPrime())
                        .putValue("capital", ligne.getCapital())
                        .putValue("taux", ligne.getTaux())
                        .putValue("tauxFranchise", ligne.getTauxFranchise())
                        .putValue("franchiseMinimale", ligne.getFranchiseMinimale())
                        .putValue("ordreAffichage", ligne.getOrdreAffichage())
                        .map())
                .toList()));
    }

    @GetMapping("/formules-garantie-personne")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> formulesGarantiePersonne(
            @RequestParam String grilleId,
            @RequestParam(required = false) String usageId,
            @RequestParam(required = false) String garantieId
    ) {
        if (grilleId == null || grilleId.isBlank()) {
            throw new BadRequestException("La grille tarifaire est obligatoire");
        }
        Usage usageFilter = usageId == null || usageId.isBlank() ? null :
                usageRepository.findById(usageId)
                        .orElseThrow(() -> new ResourceNotFoundException("Usage", usageId));
        if (usageFilter != null && !usageAllowsGarantiesPersonne(usageFilter)) {
            return ResponseEntity.ok(ApiResponse.success(List.<Map<String, Object>>of()));
        }
        return ResponseEntity.ok(ApiResponse.success(formuleGarantiePersonneRepository.findAll(Sort.by("ordreAffichage", "formule")).stream()
                .filter(formule -> Boolean.TRUE.equals(formule.getActif()))
                .filter(formule -> formule.getGrilleTarifaire() != null && formule.getGrilleTarifaire().getId().equals(grilleId))
                .filter(formule -> usageId == null || usageId.isBlank() || formule.getUsage() == null || formule.getUsage().getId().equals(usageId))
                .filter(formule -> garantieId == null || garantieId.isBlank() || formule.getGarantie().getId().equals(garantieId))
                .map(this::toFormulePersonneResponse)
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

    @PostMapping("/grilles-tarifaires/{grilleId}/usages/{usageId}/configuration")
    @Transactional
    public ResponseEntity<ApiResponse<Map<String, Object>>> replaceGrilleUsageConfiguration(
            @PathVariable String grilleId,
            @PathVariable String usageId,
            @Valid @RequestBody UpsertGrilleUsageConfigurationRequest request
    ) {
        GrilleTarifaire grille = grilleTarifaireRepository.findById(grilleId)
                .orElseThrow(() -> new ResourceNotFoundException("GrilleTarifaire", grilleId));
        Usage usage = usageRepository.findById(usageId)
                .orElseThrow(() -> new ResourceNotFoundException("Usage", usageId));

        Set<String> ligneIds = new HashSet<>();
        List<UpsertLigneGrilleTarifaireRequest> requestedLignes = request.getLignes() == null ? List.of() : request.getLignes();
        List<UpsertFormuleGarantiePersonneRequest> requestedFormules = request.getFormulesPersonne() == null ? List.of() : request.getFormulesPersonne();

        for (UpsertLigneGrilleTarifaireRequest ligneRequest : requestedLignes) {
            ligneRequest.setUsageId(usage.getId());
            ligneRequest.setActif(true);
            LigneGrilleTarifaire ligne = ligneRequest.getId() == null || ligneRequest.getId().isBlank()
                    ? new LigneGrilleTarifaire()
                    : ligneGrilleTarifaireRepository.findById(ligneRequest.getId()).orElseGet(LigneGrilleTarifaire::new);
            if (ligne.getGrilleTarifaire() != null && !ligne.getGrilleTarifaire().getId().equals(grille.getId())) {
                throw new BadRequestException("La ligne n'appartient pas a cette grille tarifaire");
            }
            ligne.setGrilleTarifaire(grille);
            applyLigneRequest(ligne, ligneRequest);
            ligneIds.add(ligneGrilleTarifaireRepository.save(ligne).getId());
        }
        for (LigneGrilleTarifaire ligne : ligneGrilleTarifaireRepository.findByGrilleTarifaireIdAndUsageIdAndActifTrue(grilleId, usageId)) {
            if (!ligneIds.contains(ligne.getId())) {
                ligne.setActif(false);
                ligneGrilleTarifaireRepository.save(ligne);
            }
        }

        if (request.getFormulesPersonne() != null) {
            Set<String> formuleIds = new HashSet<>();
            for (UpsertFormuleGarantiePersonneRequest formuleRequest : requestedFormules) {
                formuleRequest.setUsageId(usage.getId());
                formuleRequest.setActif(true);
                FormuleGarantiePersonne formule = formuleRequest.getId() == null || formuleRequest.getId().isBlank()
                        ? new FormuleGarantiePersonne()
                        : formuleGarantiePersonneRepository.findById(formuleRequest.getId()).orElseGet(FormuleGarantiePersonne::new);
                if (formule.getGrilleTarifaire() != null && !formule.getGrilleTarifaire().getId().equals(grille.getId())) {
                    throw new BadRequestException("La formule n'appartient pas a cette grille tarifaire");
                }
                formule.setGrilleTarifaire(grille);
                applyFormulePersonneRequest(formule, formuleRequest);
                formuleIds.add(formuleGarantiePersonneRepository.save(formule).getId());
            }
            for (FormuleGarantiePersonne formule : formuleGarantiePersonneRepository.findByGrilleTarifaireIdAndUsageIdAndActifTrue(grilleId, usageId)) {
                if (!formuleIds.contains(formule.getId())) {
                    formule.setActif(false);
                    formuleGarantiePersonneRepository.save(formule);
                }
            }
        }

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("lignes", ligneGrilleTarifaireRepository.findByGrilleTarifaireIdAndUsageIdAndActifTrue(grilleId, usageId).stream()
                .map(this::toLigneResponse)
                .toList());
        data.put("formulesPersonne", formuleGarantiePersonneRepository.findByGrilleTarifaireIdAndUsageIdAndActifTrue(grilleId, usageId).stream()
                .map(this::toFormulePersonneResponse)
                .toList());
        return ResponseEntity.ok(ApiResponse.success(data, "Configuration de l'usage enregistree"));
    }

    @PostMapping("/grilles-tarifaires/{grilleId}/formules-personne")
    public ResponseEntity<ApiResponse<Map<String, Object>>> createFormuleGarantiePersonne(
            @PathVariable String grilleId,
            @Valid @RequestBody UpsertFormuleGarantiePersonneRequest request
    ) {
        GrilleTarifaire grille = grilleTarifaireRepository.findById(grilleId)
                .orElseThrow(() -> new ResourceNotFoundException("GrilleTarifaire", grilleId));
        FormuleGarantiePersonne formule = new FormuleGarantiePersonne();
        formule.setGrilleTarifaire(grille);
        applyFormulePersonneRequest(formule, request);
        return ResponseEntity.ok(ApiResponse.success(toFormulePersonneResponse(formuleGarantiePersonneRepository.save(formule)), "Formule garantie personne creee"));
    }

    @PutMapping("/formules-garantie-personne/{id}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> updateFormuleGarantiePersonne(
            @PathVariable String id,
            @Valid @RequestBody UpsertFormuleGarantiePersonneRequest request
    ) {
        FormuleGarantiePersonne formule = formuleGarantiePersonneRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("FormuleGarantiePersonne", id));
        applyFormulePersonneRequest(formule, request);
        return ResponseEntity.ok(ApiResponse.success(toFormulePersonneResponse(formuleGarantiePersonneRepository.save(formule)), "Formule garantie personne modifiee"));
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
    @Transactional(readOnly = true)
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> categoriesClient() {
        return ResponseEntity.ok(ApiResponse.success(categorieClientRepository.findAllByOrderByLibelleAsc().stream()
                .map(categorie -> option(categorie.getId(), categorie.getCode(), categorie.getLibelle())
                        .putValue("usageIds", categorie.getUsages().stream()
                                .filter(usage -> Boolean.TRUE.equals(usage.getActif()))
                                .map(Usage::getId)
                                .toList())
                        .putValue("actif", categorie.getActif())
                        .map())
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

    private ReferenceOptionResponse toResponse(Marque marque) {
        return ReferenceOptionResponse.builder()
                .id(marque.getId())
                .libelle(marque.getLibelle())
                .actif(marque.getActif())
                .build();
    }

    private ReferenceOptionResponse toResponse(Carrosserie carrosserie) {
        return ReferenceOptionResponse.builder()
                .id(carrosserie.getId())
                .libelle(carrosserie.getLibelle())
                .actif(carrosserie.getActif())
                .build();
    }

    private ReferenceOptionResponse toResponse(Carburant carburant) {
        return ReferenceOptionResponse.builder()
                .id(carburant.getId())
                .code(carburant.getCode())
                .libelle(carburant.getLibelle())
                .actif(carburant.getActif())
                .build();
    }

    private ReferenceOptionResponse toResponse(SousClasse sousClasse) {
        return ReferenceOptionResponse.builder()
                .id(sousClasse.getId())
                .code(sousClasse.getCode())
                .libelle(sousClasse.getLibelle())
                .actif(sousClasse.getActif())
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

    private void applyConventionRequest(Convention convention, UpsertConventionRequest request) {
        String agenceId = TenantContext.getCurrentAgence();
        Agence agence = agenceRepository.findById(agenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Agence", agenceId));
        CompagnieAssurance compagnie = compagnieAssuranceRepository.findById(request.getCompagnieAssuranceId())
                .orElseThrow(() -> new ResourceNotFoundException("CompagnieAssurance", request.getCompagnieAssuranceId()));
        CategorieClient categorieClient = categorieClientRepository.findById(request.getCategorieClientId())
                .orElseThrow(() -> new ResourceNotFoundException("CategorieClient", request.getCategorieClientId()));
        GrilleTarifaire grille = grilleTarifaireRepository.findById(request.getGrilleTarifaireId())
                .orElseThrow(() -> new ResourceNotFoundException("GrilleTarifaire", request.getGrilleTarifaireId()));
        if (grille.getCompagnieAssurance() == null || !grille.getCompagnieAssurance().getId().equals(compagnie.getId())) {
            throw new BadRequestException("La grille tarifaire doit appartenir a la compagnie selectionnee");
        }

        Set<String> usageIds = new LinkedHashSet<>(request.getUsageIds() == null ? List.of() : request.getUsageIds());
        if (usageIds.isEmpty()) {
            throw new BadRequestException("Au moins un usage doit etre autorise pour la convention");
        }
        Set<Usage> usages = new LinkedHashSet<>(usageRepository.findAllById(usageIds));
        if (usages.size() != usageIds.size()) {
            throw new BadRequestException("Un ou plusieurs usages sont introuvables");
        }
        if (categorieClient.getUsages() != null && !categorieClient.getUsages().isEmpty()) {
            Set<String> allowedUsageIds = categorieClient.getUsages().stream()
                    .filter(usage -> Boolean.TRUE.equals(usage.getActif()))
                    .map(Usage::getId)
                    .collect(java.util.stream.Collectors.toSet());
            boolean hasInvalidUsage = usages.stream().anyMatch(usage -> !allowedUsageIds.contains(usage.getId()));
            if (hasInvalidUsage) {
                throw new BadRequestException("Les usages selectionnes ne correspondent pas a la categorie client");
            }
        }

        TypeEcheanceConvention typeEcheance = request.getTypeEcheance() == null
                ? TypeEcheanceConvention.DATE_A_DATE
                : request.getTypeEcheance();
        String echeance = blankToNull(request.getEcheance());
        if (typeEcheance == TypeEcheanceConvention.A_ECHEANCE
                && (echeance == null || !echeance.matches("\\d{2}/\\d{2}"))) {
            throw new BadRequestException("Echeance convention invalide. Format attendu: JJ/MM");
        }
        convention.setAgence(agence);
        convention.setCompagnieAssurance(compagnie);
        convention.setCode(request.getCode());
        convention.setIntitule(request.getIntitule());
        convention.setDescription(blankToNull(request.getDescription()));
        convention.setOrganismeConventionne(blankToNull(request.getOrganismeConventionne()));
        convention.setCategorieClient(categorieClient);
        convention.setGrilleTarifaire(grille);
        convention.setDateEffet(request.getDateEffet());
        convention.setDateEcheance(request.getDateEcheance());
        convention.setTypeEcheance(typeEcheance);
        convention.setEcheance(typeEcheance == TypeEcheanceConvention.A_ECHEANCE ? echeance : null);
        convention.setFractionnement(request.getFractionnement());
        convention.setActif(request.getActif() == null ? true : request.getActif());
        convention.getUsages().clear();
        convention.getUsages().addAll(usages);
    }

    private Map<String, Object> toConventionResponse(Convention convention) {
        CompagnieAssurance compagnie = convention.getCompagnieAssurance();
        CategorieClient categorieClient = convention.getCategorieClient();
        GrilleTarifaire grille = convention.getGrilleTarifaire();
        return option(convention.getId(), convention.getCode(), convention.getIntitule())
                .putValue("description", convention.getDescription())
                .putValue("compagnieAssuranceId", compagnie != null ? compagnie.getId() : null)
                .putValue("compagnieAssuranceLibelle", compagnie != null ? compagnie.getNom() : null)
                .putValue("organismeConventionne", convention.getOrganismeConventionne())
                .putValue("categorieClientId", categorieClient != null ? categorieClient.getId() : null)
                .putValue("categorieClientLibelle", categorieClient != null ? categorieClient.getLibelle() : null)
                .putValue("grilleTarifaireId", grille != null ? grille.getId() : null)
                .putValue("grilleTarifaireLibelle", grille != null ? grille.getLibelle() : null)
                .putValue("dateEffet", convention.getDateEffet())
                .putValue("dateEcheance", convention.getDateEcheance())
                .putValue("typeEcheance", convention.getTypeEcheance())
                .putValue("echeance", convention.getEcheance())
                .putValue("fractionnement", convention.getFractionnement())
                .putValue("usageIds", convention.getUsages().stream().map(Usage::getId).toList())
                .putValue("usageLibelles", convention.getUsages().stream()
                        .sorted(Comparator.comparing(Usage::getCode, Comparator.nullsLast(Comparator.naturalOrder())))
                        .map(usage -> (usage.getCode() == null ? "" : usage.getCode() + " - ") + usage.getLibelle())
                        .toList())
                .putValue("actif", convention.getActif())
                .map();
    }

    private void applyCompagnieAssuranceRequest(CompagnieAssurance compagnie, UpsertCompagnieAssuranceRequest request) {
        compagnie.setCode(request.getCode());
        compagnie.setNom(request.getNom());
        compagnie.setAdresse(blankToNull(request.getAdresse()));
        compagnie.setVille(blankToNull(request.getVille()));
        compagnie.setEmail(blankToNull(request.getEmail()));
        compagnie.setTelephone(blankToNull(request.getTelephone()));
        compagnie.setRc(blankToNull(request.getRc()));
        compagnie.setIce(blankToNull(request.getIce()));
        compagnie.setPrefixeAttestation(blankToNull(request.getPrefixeAttestation()));
        compagnie.setOrdreAffichage(request.getOrdreAffichage() == null ? 100 : request.getOrdreAffichage());
        compagnie.setActif(request.getActif() == null ? true : request.getActif());
    }

    private Map<String, Object> toCompagnieAssuranceResponse(CompagnieAssurance compagnie) {
        return option(compagnie.getId(), compagnie.getCode(), compagnie.getNom())
                .putValue("nom", compagnie.getNom())
                .putValue("adresse", compagnie.getAdresse())
                .putValue("ville", compagnie.getVille())
                .putValue("email", compagnie.getEmail())
                .putValue("telephone", compagnie.getTelephone())
                .putValue("rc", compagnie.getRc())
                .putValue("ice", compagnie.getIce())
                .putValue("prefixeAttestation", compagnie.getPrefixeAttestation())
                .putValue("ordreAffichage", compagnie.getOrdreAffichage())
                .putValue("actif", compagnie.getActif())
                .map();
    }

    private void applyUsageRequest(Usage usage, UpsertUsageRequest request) {
        GroupeUsageAttestation groupe = request.getGroupeUsageAttestationId() == null || request.getGroupeUsageAttestationId().isBlank() ? null :
                groupeUsageAttestationRepository.findById(request.getGroupeUsageAttestationId())
                        .orElseThrow(() -> new ResourceNotFoundException("GroupeUsageAttestation", request.getGroupeUsageAttestationId()));
        usage.setCode(request.getCode());
        usage.setLibelle(request.getLibelle());
        usage.setCriteria(request.getCriteria());
        usage.setGroupeUsageAttestation(groupe);
        usage.setConsommeAttestation(request.getConsommeAttestation() == null ? true : request.getConsommeAttestation());
        usage.setByCarburantAndPf(Boolean.TRUE.equals(request.getByCarburantAndPf()));
        usage.setBySousClasse(Boolean.TRUE.equals(request.getBySousClasse()));
        usage.setByPtc(Boolean.TRUE.equals(request.getByPtc()));
        usage.setByPrime(Boolean.TRUE.equals(request.getByPrime()));
        usage.setByCategorieTransport(Boolean.TRUE.equals(request.getByCategorieTransport()));
        usage.setGarantiesPersonne(Boolean.TRUE.equals(request.getGarantiesPersonne()));
        usage.setActif(request.getActif() == null ? true : request.getActif());
    }

    private Map<String, Object> toUsageResponse(Usage usage) {
        return option(usage.getId(), usage.getCode(), usage.getLibelle())
                .putValue("criteria", usage.getCriteria())
                .putValue("byCarburantAndPf", usage.getByCarburantAndPf())
                .putValue("bySousClasse", usage.getBySousClasse())
                .putValue("byPtc", usage.getByPtc())
                .putValue("byPrime", usage.getByPrime())
                .putValue("byCategorieTransport", usage.getByCategorieTransport())
                .putValue("garantiesPersonne", Boolean.TRUE.equals(usage.getGarantiesPersonne()))
                .putValue("consommeAttestation", usage.getConsommeAttestation())
                .putValue("groupeUsageAttestationId", usage.getGroupeUsageAttestation() != null ? usage.getGroupeUsageAttestation().getId() : null)
                .putValue("groupeUsageAttestationCode", usage.getGroupeUsageAttestation() != null ? usage.getGroupeUsageAttestation().getCode() : null)
                .putValue("actif", usage.getActif())
                .map();
    }

    private void applyTarifUsageRequest(TarifUsage tarif, UpsertTarifUsageRequest request) {
        Usage usage = usageRepository.findById(request.getUsageId())
                .orElseThrow(() -> new ResourceNotFoundException("Usage", request.getUsageId()));
        CategorieTransport categorieTransport = request.getCategorieTransportId() == null || request.getCategorieTransportId().isBlank() ? null :
                categorieTransportRepository.findById(request.getCategorieTransportId())
                        .orElseThrow(() -> new ResourceNotFoundException("CategorieTransport", request.getCategorieTransportId()));
        tarif.setUsage(usage);
        tarif.setCategorieTransport(categorieTransport);
        tarif.setPuissanceFiscaleMin(request.getPuissanceFiscaleMin());
        tarif.setPuissanceFiscaleMax(request.getPuissanceFiscaleMax());
        tarif.setNombrePlacesMin(request.getNombrePlacesMin());
        tarif.setNombrePlacesMax(request.getNombrePlacesMax());
        tarif.setPtcMin(request.getPtcMin());
        tarif.setPtcMax(request.getPtcMax());
        tarif.setSousClasse(blankToNull(request.getSousClasse()));
        tarif.setCarburant(blankToNull(request.getCarburant()));
        tarif.setPrimeNette(request.getPrimeNette());
        tarif.setPrimeParPlace(request.getPrimeParPlace());
        tarif.setActif(request.getActif() == null ? true : request.getActif());
    }

    private Map<String, Object> toTarifUsageResponse(TarifUsage tarif) {
        Usage usage = tarif.getUsage();
        CategorieTransport categorieTransport = tarif.getCategorieTransport();
        return option(tarif.getId(), usage != null ? usage.getCode() : null, usage != null ? usage.getLibelle() : "Tarif usage")
                .putValue("usageId", usage != null ? usage.getId() : null)
                .putValue("usageCode", usage != null ? usage.getCode() : null)
                .putValue("usageLibelle", usage != null ? usage.getLibelle() : null)
                .putValue("byCarburantAndPf", usage != null ? usage.getByCarburantAndPf() : null)
                .putValue("bySousClasse", usage != null ? usage.getBySousClasse() : null)
                .putValue("byPtc", usage != null ? usage.getByPtc() : null)
                .putValue("byPrime", usage != null ? usage.getByPrime() : null)
                .putValue("byCategorieTransport", usage != null ? usage.getByCategorieTransport() : null)
                .putValue("categorieTransportId", categorieTransport != null ? categorieTransport.getId() : null)
                .putValue("categorieTransportLibelle", categorieTransport != null ? categorieTransport.getLibelle() : null)
                .putValue("puissanceFiscaleMin", tarif.getPuissanceFiscaleMin())
                .putValue("puissanceFiscaleMax", tarif.getPuissanceFiscaleMax())
                .putValue("nombrePlacesMin", tarif.getNombrePlacesMin())
                .putValue("nombrePlacesMax", tarif.getNombrePlacesMax())
                .putValue("ptcMin", tarif.getPtcMin())
                .putValue("ptcMax", tarif.getPtcMax())
                .putValue("sousClasse", tarif.getSousClasse())
                .putValue("carburant", tarif.getCarburant())
                .putValue("primeNette", tarif.getPrimeNette())
                .putValue("primeParPlace", tarif.getPrimeParPlace())
                .putValue("actif", tarif.getActif())
                .map();
    }

    private List<TarifUsage> resolveBulkTarifTargets(BulkUpdateTarifUsageRequest request) {
        Set<String> tarifIds = new HashSet<>(request.getTarifIds() == null ? List.of() : request.getTarifIds());
        Set<String> usageIds = new HashSet<>(request.getUsageIds() == null ? List.of() : request.getUsageIds());
        return tarifUsageRepository.findAll().stream()
                .filter(tarif -> Boolean.TRUE.equals(tarif.getActif()))
                .filter(tarif -> tarifIds.isEmpty() || tarifIds.contains(tarif.getId()))
                .filter(tarif -> !tarifIds.isEmpty()
                        || usageIds.isEmpty()
                        || (tarif.getUsage() != null && usageIds.contains(tarif.getUsage().getId())))
                .toList();
    }

    private BigDecimal adjustPrimeNette(BigDecimal currentPrime, String adjustmentType, String direction, BigDecimal value) {
        BigDecimal basePrime = currentPrime == null ? BigDecimal.ZERO : currentPrime;
        BigDecimal adjusted;
        if ("PERCENT".equals(adjustmentType)) {
            BigDecimal factor = value.divide(BigDecimal.valueOf(100), 8, RoundingMode.HALF_UP);
            adjusted = "DECREASE".equals(direction)
                    ? basePrime.multiply(BigDecimal.ONE.subtract(factor))
                    : basePrime.multiply(BigDecimal.ONE.add(factor));
        } else {
            adjusted = "DECREASE".equals(direction) ? basePrime.subtract(value) : basePrime.add(value);
        }
        if (adjusted.signum() < 0) {
            adjusted = BigDecimal.ZERO;
        }
        return adjusted.setScale(2, RoundingMode.HALF_UP);
    }

    private void applyLigneRequest(LigneGrilleTarifaire ligne, UpsertLigneGrilleTarifaireRequest request) {
        Garantie garantie = garantieRepository.findById(request.getGarantieId())
                .orElseThrow(() -> new ResourceNotFoundException("Garantie", request.getGarantieId()));
        if (garantie.getTypeGarantie() == TypeGarantie.PERSONNE) {
            throw new BadRequestException("Les garanties personne doivent etre configurees dans les formules personne");
        }
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
        ligne.setPrime(request.getPrime());
        ligne.setCapital(request.getCapital());
        ligne.setLibelleOption(request.getLibelleOption());
        ligne.setOrdreAffichage(request.getOrdreAffichage());
        ligne.setModeTarification(request.getModeTarification());
        ligne.setActif(request.getActif() == null ? true : request.getActif());
    }

    private void applyFormulePersonneRequest(FormuleGarantiePersonne formule, UpsertFormuleGarantiePersonneRequest request) {
        Garantie garantie = garantieRepository.findById(request.getGarantieId())
                .orElseThrow(() -> new ResourceNotFoundException("Garantie", request.getGarantieId()));
        if (garantie.getTypeGarantie() != TypeGarantie.PERSONNE) {
            throw new BadRequestException("La garantie doit etre de type personne");
        }
        Usage usage = request.getUsageId() == null || request.getUsageId().isBlank() ? null :
                usageRepository.findById(request.getUsageId())
                        .orElseThrow(() -> new ResourceNotFoundException("Usage", request.getUsageId()));
        if (usage != null && !usageAllowsGarantiesPersonne(usage)) {
            throw new BadRequestException("Cet usage n'autorise pas les garanties personne");
        }
        formule.setGarantie(garantie);
        formule.setUsage(usage);
        formule.setFormule(request.getFormule() == null || request.getFormule().isBlank() ? garantie.getCode() : request.getFormule());
        formule.setMontantDeces(request.getMontantDeces());
        formule.setMontantInvalidite(request.getMontantInvalidite());
        formule.setMontantFraisMedicaux(request.getMontantFraisMedicaux());
        formule.setMontantFraisHospitalisation(request.getMontantFraisHospitalisation());
        formule.setMontantFraisFuneraires(request.getMontantFraisFuneraires());
        formule.setMontantFraisChirurgie(request.getMontantFraisChirurgie());
        formule.setPrimeNette(request.getPrimeNette());
        formule.setAccessoire(request.getAccessoire());
        formule.setOrdreAffichage(request.getOrdreAffichage());
        formule.setActif(request.getActif() == null ? true : request.getActif());
    }

    private Map<String, Object> toLigneResponse(LigneGrilleTarifaire ligne) {
        return option(ligne.getId(), null, ligne.getLibelleOption() != null ? ligne.getLibelleOption() : ligne.getGarantie().getLibelle())
                .putValue("grilleId", ligne.getGrilleTarifaire() != null ? ligne.getGrilleTarifaire().getId() : null)
                .putValue("garantieId", ligne.getGarantie() != null ? ligne.getGarantie().getId() : null)
                .putValue("garantieCode", ligne.getGarantie() != null ? ligne.getGarantie().getCode() : null)
                .putValue("garantieLibelle", ligne.getGarantie() != null ? ligne.getGarantie().getLibelle() : null)
                .putValue("usageId", ligne.getUsage() != null ? ligne.getUsage().getId() : null)
                .putValue("categorieTransportId", ligne.getCategorieTransport() != null ? ligne.getCategorieTransport().getId() : null)
                .putValue("modeTarification", ligne.getModeTarification())
                .putValue("puissanceFiscaleMin", ligne.getPuissanceFiscaleMin())
                .putValue("puissanceFiscaleMax", ligne.getPuissanceFiscaleMax())
                .putValue("nombrePlacesMin", ligne.getNombrePlacesMin())
                .putValue("nombrePlacesMax", ligne.getNombrePlacesMax())
                .putValue("ptcMin", ligne.getPtcMin())
                .putValue("ptcMax", ligne.getPtcMax())
                .putValue("sousClasse", ligne.getSousClasse())
                .putValue("carburant", ligne.getCarburant())
                .putValue("prime", ligne.getPrime())
                .putValue("capital", ligne.getCapital())
                .putValue("taux", ligne.getTaux())
                .putValue("tauxFranchise", ligne.getTauxFranchise())
                .putValue("franchiseMinimale", ligne.getFranchiseMinimale())
                .putValue("ordreAffichage", ligne.getOrdreAffichage())
                .putValue("actif", ligne.getActif())
                .map();
    }

    private Map<String, Object> toFormulePersonneResponse(FormuleGarantiePersonne formule) {
        return option(formule.getId(), null, formule.getFormule())
                .putValue("grilleId", formule.getGrilleTarifaire() != null ? formule.getGrilleTarifaire().getId() : null)
                .putValue("garantieId", formule.getGarantie() != null ? formule.getGarantie().getId() : null)
                .putValue("garantieCode", formule.getGarantie() != null ? formule.getGarantie().getCode() : null)
                .putValue("garantieLibelle", formule.getGarantie() != null ? formule.getGarantie().getLibelle() : null)
                .putValue("usageId", formule.getUsage() != null ? formule.getUsage().getId() : null)
                .putValue("usageCode", formule.getUsage() != null ? formule.getUsage().getCode() : null)
                .putValue("usageLibelle", formule.getUsage() != null ? formule.getUsage().getLibelle() : null)
                .putValue("montantDeces", formule.getMontantDeces())
                .putValue("montantInvalidite", formule.getMontantInvalidite())
                .putValue("montantFraisMedicaux", formule.getMontantFraisMedicaux())
                .putValue("montantFraisHospitalisation", formule.getMontantFraisHospitalisation())
                .putValue("montantFraisFuneraires", formule.getMontantFraisFuneraires())
                .putValue("montantFraisChirurgie", formule.getMontantFraisChirurgie())
                .putValue("primeNette", formule.getPrimeNette())
                .putValue("accessoire", formule.getAccessoire())
                .putValue("actif", formule.getActif())
                .map();
    }

    private Map<String, Object> toProduitAssistanceResponse(ProduitAssistance produit) {
        TarifProduitAssistance tarif = produit.getTarifs() == null ? null : produit.getTarifs().stream()
                .filter(item -> Boolean.TRUE.equals(item.getActif()))
                .findFirst()
                .orElse(null);
        return option(produit.getId(), null, produit.getLibelle())
                .putValue("type", produit.getType())
                .putValue("compagnieAssistanceId", produit.getCompagnieAssistance() != null ? produit.getCompagnieAssistance().getId() : null)
                .putValue("compagnieAssistanceLibelle", produit.getCompagnieAssistance() != null ? produit.getCompagnieAssistance().getNom() : null)
                .putValue("categorieClientId", produit.getCategorieClient() != null ? produit.getCategorieClient().getId() : null)
                .putValue("categorieClientLibelle", produit.getCategorieClient() != null ? produit.getCategorieClient().getLibelle() : null)
                .putValue("usageIds", produit.getUsages() == null ? List.of() : produit.getUsages().stream().map(Usage::getId).toList())
                .putValue("usageCodes", produit.getUsages() == null ? List.of() : produit.getUsages().stream().map(Usage::getCode).toList())
                .putValue("montantHt", tarif != null ? tarif.getMontantHt() : null)
                .putValue("montantTtc", tarif != null ? tarif.getMontantTtc() : null)
                .putValue("dateDebutTarif", tarif != null ? tarif.getDateDebut() : null)
                .putValue("dateFinTarif", tarif != null ? tarif.getDateFin() : null)
                .putValue("actif", produit.getActif())
                .map();
    }

    private boolean usageAllowsGarantiesPersonne(Usage usage) {
        return usage != null && Boolean.TRUE.equals(usage.getGarantiesPersonne());
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
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
