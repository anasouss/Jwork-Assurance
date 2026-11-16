package com.assurance.service;

import com.assurance.activity.*;
import com.assurance.dto.request.UpsertDomaineInterventionRequest;
import com.assurance.dto.response.DomaineInterventionResponse;
import com.assurance.entity.*;
import com.assurance.enums.TypePrestataireSinistre;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DomaineInterventionSinistreService {
    private final DomaineInterventionSinistreRepository repository;
    private final BrancheAssuranceRepository branches;
    private final AgenceRepository agencies;
    private final GarageSinistreRepository garages;
    private final ExpertSinistreRepository experts;
    private final PrestataireMedicalSinistreRepository medical;
    private final SpecialitePrestataireSinistreRepository specialties;
    private final GarantieRepository guarantees;
    private final BusinessActivityRecorder activity;

    @Transactional(readOnly = true)
    public List<DomaineInterventionResponse> list(Long agency) {
        return repository.findByAgenceIdOrderByLibelleAsc(agency).stream().map(this::response).toList();
    }

    public DomaineInterventionSinistre require(Long agency, Long id) {
        return repository.findByIdAndAgenceId(id, agency).orElseThrow(() -> new ResourceNotFoundException("Domaine", id));
    }

    public void configure(Long agency, TypePrestataireSinistre type, Set<DomaineInterventionSinistre> current, List<Long> ids) {
        if (ids == null) return;
        Set<Long> existing = current.stream().map(BaseEntity::getId).collect(Collectors.toSet());
        Set<DomaineInterventionSinistre> resolved = new LinkedHashSet<>();
        for (Long id : new LinkedHashSet<>(ids)) {
            var domain = require(agency, id);
            if (!domain.getOperateurs().contains(type)) throw new BadRequestException("Opérateur incompatible avec le domaine " + domain.getLibelle());
            if (!domain.isActif() && !existing.contains(id)) throw new BadRequestException("Un domaine sélectionné est inactif");
            resolved.add(domain);
        }
        current.clear();
        current.addAll(resolved);
    }

    @Transactional
    public DomaineInterventionResponse save(Long agency, Long id, UpsertDomaineInterventionRequest request) {
        String code = request.getCode().trim().toUpperCase(Locale.ROOT);
        if (repository.existsByAgenceIdAndCodeIgnoreCaseAndIdNot(agency, code, id == null ? 0L : id)) {
            throw new BadRequestException("Ce code domaine existe déjà dans l'agence");
        }
        var domain = id == null ? DomaineInterventionSinistre.builder().agence(agencies.getReferenceById(agency)).build() : require(agency, id);
        var branch = branches.findById(request.getBrancheId()).orElseThrow(() -> new ResourceNotFoundException("Branche", request.getBrancheId()));
        if (!Boolean.TRUE.equals(branch.getActif()) && (domain.getBrancheAssurance() == null || !domain.getBrancheAssurance().getId().equals(branch.getId()))) {
            throw new BadRequestException("La branche sélectionnée est inactive");
        }
        if (id != null) {
            for (var type : domain.getOperateurs()) {
                boolean used = specialties.existsByDomainesIdAndTypePrestataire(id, type)
                        || (type == TypePrestataireSinistre.GARAGE && garages.existsByDomainesId(id))
                        || (type == TypePrestataireSinistre.EXPERT && experts.existsByDomainesId(id))
                        || medical.existsByDomainesIdAndTypePrestataire(id, type);
                if (used && !request.getOperateurs().contains(type)) throw new BadRequestException("Cet opérateur est déjà utilisé dans le domaine");
            }
            boolean linkedSpecialty = specialties.findByAgenceIdOrderByLibelleAsc(agency).stream()
                    .anyMatch(s -> s.getDomaines().stream().anyMatch(d -> d.getId().equals(id)));
            if (linkedSpecialty && !domain.getBrancheAssurance().getId().equals(branch.getId())) {
                throw new BadRequestException("Détachez les spécialités du domaine avant de changer sa branche");
            }
        }
        var before = id == null ? Map.<String, String>of() : snapshot(domain);
        domain.setCode(code);
        domain.setLibelle(request.getLibelle().trim());
        domain.setBrancheAssurance(branch);
        domain.setActif(request.isActif());
        domain.getOperateurs().clear();
        domain.getOperateurs().addAll(request.getOperateurs());
        domain = repository.save(domain);
        activity.record(new ActivityCommand(agency, ActivityModule.SINISTRES, id == null ? ActivityAction.CREATED : ActivityAction.UPDATED,
                "Domaine d'intervention enregistré", "CLAIM_PROVIDER_DOMAIN",
                new ActivityReference(ActivityRecordType.REFERENTIEL, "DOMAINE_PRESTATAIRE:" + domain.getId(), domain.getLibelle()),
                List.of(), ActivityValues.changes(before, snapshot(domain))));
        return response(domain);
    }

    public DomaineInterventionResponse response(DomaineInterventionSinistre domain) {
        return new DomaineInterventionResponse(domain.getId(), domain.getCode(), domain.getLibelle(), domain.isActif(),
                domain.getBrancheAssurance().getId(), domain.getBrancheAssurance().getLibelle(), Set.copyOf(domain.getOperateurs()));
    }

    private Map<String, String> snapshot(DomaineInterventionSinistre domain) {
        return new ActivityValues().put("Code", domain.getCode()).put("Libellé", domain.getLibelle()).put("Actif", domain.isActif())
                .put("Branche", domain.getBrancheAssurance().getLibelle())
                .put("Opérateurs", domain.getOperateurs().stream().map(Enum::name).sorted().collect(Collectors.joining(", "))).snapshot();
    }

    @Transactional
    public void seedDefaults(Agence agency) {
        if (!repository.findByAgenceIdOrderByLibelleAsc(agency.getId()).isEmpty()) return;
        seed(agency, "AUTOMOBILE", "Automobile", "AUTOMOBILE", Set.of(TypePrestataireSinistre.GARAGE, TypePrestataireSinistre.EXPERT));
        seed(agency, "AT", "Accidents du travail", "RISQUES_DIVERS", Set.of(TypePrestataireSinistre.MEDECIN, TypePrestataireSinistre.CLINIQUE,
                TypePrestataireSinistre.PHARMACIE, TypePrestataireSinistre.RADIOLOGIE, TypePrestataireSinistre.KINESITHERAPIE));
        seed(agency, "RC", "Responsabilité civile", "RISQUES_DIVERS", Set.of(TypePrestataireSinistre.CLINIQUE));
        var automobile = repository.findByAgenceIdOrderByLibelleAsc(agency.getId()).stream()
                .filter(d -> d.getCode().equals("AUTOMOBILE")).findFirst();
        if (automobile.isEmpty()) return;
        var domain = automobile.get();
        var existing = specialties.findByAgenceIdOrderByLibelleAsc(agency.getId());
        existing.stream().filter(s -> domain.getOperateurs().contains(s.getTypePrestataire()))
                .filter(s -> s.getGaranties().stream().anyMatch(g -> g.getBrancheAssurance() != null
                        && g.getBrancheAssurance().getId().equals(domain.getBrancheAssurance().getId())))
                .forEach(s -> s.getDomaines().add(domain));
        boolean glassConfigured = existing.stream().anyMatch(s -> s.getTypePrestataire() == TypePrestataireSinistre.GARAGE
                && s.getGaranties().stream().anyMatch(g -> "BG".equals(g.getCode())));
        if (!glassConfigured && existing.stream().noneMatch(s -> "BGS".equals(s.getCode()))) {
            guarantees.findByCode("BG").filter(g -> g.getBrancheAssurance() != null
                    && g.getBrancheAssurance().getId().equals(domain.getBrancheAssurance().getId())).ifPresent(glass -> {
                // Activate after assigning qualified garages; do not change existing claim eligibility at startup.
                specialties.save(SpecialitePrestataireSinistre.builder().agence(agency).code("BGS").libelle("Bris de glace")
                        .typePrestataire(TypePrestataireSinistre.GARAGE).actif(false)
                        .garanties(new LinkedHashSet<>(Set.of(glass))).domaines(new LinkedHashSet<>(Set.of(domain))).build());
            });
        }
    }

    private void seed(Agence agency, String code, String label, String branchCode, Set<TypePrestataireSinistre> types) {
        if (repository.existsByAgenceIdAndCodeIgnoreCaseAndIdNot(agency.getId(), code, 0L)) return;
        branches.findByCodeIgnoreCase(branchCode).ifPresent(branch -> repository.save(DomaineInterventionSinistre.builder()
                .agence(agency).code(code).libelle(label).brancheAssurance(branch).operateurs(new LinkedHashSet<>(types)).build()));
    }
}
