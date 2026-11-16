package com.assurance.service;

import com.assurance.activity.ActivityRecordType;
import com.assurance.activity.BusinessActivityRecorder;
import com.assurance.activity.ClaimActivity;
import com.assurance.dto.request.UpsertExpertSinistreRequest;
import com.assurance.dto.request.UpsertGarageSinistreRequest;
import com.assurance.dto.response.SinistreIntervenantResponse;
import com.assurance.entity.Agence;
import com.assurance.entity.ExpertSinistre;
import com.assurance.entity.GarageSinistre;
import com.assurance.entity.Ville;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.AgenceRepository;
import com.assurance.repository.ExpertSinistreRepository;
import com.assurance.repository.GarageSinistreRepository;
import com.assurance.repository.VilleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class SinistreIntervenantService {

    private final AgenceRepository agenceRepository;
    private final VilleRepository villeRepository;
    private final ExpertSinistreRepository expertRepository;
    private final GarageSinistreRepository garageRepository;
    private final BusinessActivityRecorder activityRecorder;
    private final PrestataireSinistreService prestataireService;
    private final com.assurance.repository.PrestataireMedicalSinistreRepository medicalRepository;
    private final DomaineInterventionSinistreService domaines;
    private final com.assurance.repository.PrestataireDirectoryRepository directoryRepository;

    @Transactional(readOnly = true)
    public List<SinistreIntervenantResponse> listExperts(Long agenceId, boolean includeInactive) {
        return listExperts(agenceId, includeInactive, null);
    }

    @Transactional(readOnly = true)
    public List<SinistreIntervenantResponse> listExperts(Long agenceId, boolean includeInactive, Long villeId) {
        List<ExpertSinistre> experts;
        if (villeId == null) {
            experts = includeInactive
                    ? expertRepository.findByAgenceIdOrderByNomAsc(agenceId)
                    : expertRepository.findByAgenceIdAndActifTrueOrderByNomAsc(agenceId);
        } else {
            experts = includeInactive
                    ? expertRepository.findByAgenceIdAndVilleIdOrderByNomAsc(agenceId, villeId)
                    : expertRepository.findByAgenceIdAndVilleIdAndActifTrueOrderByNomAsc(agenceId, villeId);
        }
        return experts.stream().map(this::toResponse).toList();
    }

    @Transactional
    public SinistreIntervenantResponse saveExpert(
            Long agenceId,
            Long id,
            UpsertExpertSinistreRequest request
    ) {
        String code = normalizeCode(request.getCode());
        boolean duplicate = id == null
                ? expertRepository.existsByAgenceIdAndCodeIgnoreCase(agenceId, code)
                : expertRepository.existsByAgenceIdAndCodeIgnoreCaseAndIdNot(agenceId, code, id);
        if (duplicate) {
            throw new BadRequestException("Ce code expert existe déjà dans l'agence");
        }
        ExpertSinistre expert = id == null
                ? ExpertSinistre.builder().agence(resolveAgency(agenceId)).build()
                : expertRepository.findByIdAndAgenceId(id, agenceId)
                .orElseThrow(() -> new ResourceNotFoundException("ExpertSinistre", id));
        var before = id == null ? java.util.Map.<String, String>of() : ClaimActivity.intervenantSnapshot(toResponse(expert));
        expert.setCode(code);
        expert.setNom(request.getNom().trim());
        expert.setTelephone(trimToNull(request.getTelephone()));
        expert.setEmail(trimToNull(request.getEmail()));
        expert.setAdresse(trimToNull(request.getAdresse()));
        expert.setVille(resolveVille(request.getVilleId()));
        expert.setActif(request.getActif() == null || request.getActif());
        prestataireService.configure(expert, request);
        expert = expertRepository.save(expert);
        var response = toResponse(expert);
        activityRecorder.record(ClaimActivity.intervenantCommand(expert.getAgence().getId(), response, before, ActivityRecordType.EXPERT_SINISTRE, id == null));
        return response;
    }

    @Transactional(readOnly = true)
    public List<SinistreIntervenantResponse> listGarages(Long agenceId, boolean includeInactive) {
        List<GarageSinistre> garages = includeInactive
                ? garageRepository.findByAgenceIdOrderByRaisonSocialeAsc(agenceId)
                : garageRepository.findByAgenceIdAndActifTrueOrderByRaisonSocialeAsc(agenceId);
        return garages.stream().map(this::toResponse).toList();
    }

    @Transactional
    public SinistreIntervenantResponse saveGarage(
            Long agenceId,
            Long id,
            UpsertGarageSinistreRequest request
    ) {
        String code = normalizeCode(request.getCode());
        boolean duplicate = id == null
                ? garageRepository.existsByAgenceIdAndCodeIgnoreCase(agenceId, code)
                : garageRepository.existsByAgenceIdAndCodeIgnoreCaseAndIdNot(agenceId, code, id);
        if (duplicate) {
            throw new BadRequestException("Ce code garage existe déjà dans l'agence");
        }
        GarageSinistre garage = id == null
                ? GarageSinistre.builder().agence(resolveAgency(agenceId)).build()
                : garageRepository.findByIdAndAgenceId(id, agenceId)
                .orElseThrow(() -> new ResourceNotFoundException("GarageSinistre", id));
        var before = id == null ? java.util.Map.<String, String>of() : ClaimActivity.intervenantSnapshot(toResponse(garage));
        garage.setCode(code);
        garage.setRaisonSociale(request.getRaisonSociale().trim());
        garage.setTelephone(trimToNull(request.getTelephone()));
        garage.setEmail(trimToNull(request.getEmail()));
        garage.setAdresse(trimToNull(request.getAdresse()));
        garage.setVille(resolveVille(request.getVilleId()));
        garage.setActif(request.getActif() == null || request.getActif());
        prestataireService.configure(garage, request);
        garage = garageRepository.save(garage);
        var response = toResponse(garage);
        activityRecorder.record(ClaimActivity.intervenantCommand(garage.getAgence().getId(), response, before, ActivityRecordType.GARAGE_SINISTRE, id == null));
        return response;
    }

    private Agence resolveAgency(Long agenceId) {
        return agenceRepository.findById(agenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Agence", agenceId));
    }

    private Ville resolveVille(Long villeId) {
        return villeId == null
                ? null
                : villeRepository.findById(villeId)
                .orElseThrow(() -> new ResourceNotFoundException("Ville", villeId));
    }

    private SinistreIntervenantResponse toResponse(ExpertSinistre expert) {
        return SinistreIntervenantResponse.builder()
                .id(expert.getId())
                .code(expert.getCode())
                .nom(expert.getNom())
                .telephone(expert.getTelephone())
                .email(expert.getEmail())
                .adresse(expert.getAdresse())
                .villeId(expert.getVille() == null ? null : expert.getVille().getId())
                .ville(expert.getVille() == null ? null : expert.getVille().getNom())
                .actif(expert.isActif())
                .typePrestataire(com.assurance.enums.TypePrestataireSinistre.EXPERT)
                .toutesCompagnies(expert.isToutesCompagnies())
                .specialites(expert.getSpecialites().stream().map(prestataireService::specialiteResponse).toList())
                .domaines(domainResponses(expert.getDomaines()))
                .accords(accordResponses(expert.getAccords()))
                .build();
    }

    private SinistreIntervenantResponse toResponse(GarageSinistre garage) {
        return SinistreIntervenantResponse.builder()
                .id(garage.getId())
                .code(garage.getCode())
                .nom(garage.getRaisonSociale())
                .telephone(garage.getTelephone())
                .email(garage.getEmail())
                .adresse(garage.getAdresse())
                .villeId(garage.getVille() == null ? null : garage.getVille().getId())
                .ville(garage.getVille() == null ? null : garage.getVille().getNom())
                .actif(garage.isActif())
                .typePrestataire(com.assurance.enums.TypePrestataireSinistre.GARAGE)
                .toutesCompagnies(garage.isToutesCompagnies())
                .specialites(garage.getSpecialites().stream().map(prestataireService::specialiteResponse).toList())
                .domaines(domainResponses(garage.getDomaines()))
                .accords(accordResponses(garage.getAccords()))
                .build();
    }

    private List<SinistreIntervenantResponse.Accord> accordResponses(java.util.Set<com.assurance.entity.AccordPrestataireSinistre> agreements) {
        return agreements.stream().sorted(java.util.Comparator.comparing(a -> a.getCompagnie().getNom()))
                .map(a -> new SinistreIntervenantResponse.Accord(a.getCompagnie().getId(), a.getCompagnie().getNom(),
                        a.isActif(), a.isConventionne(), a.getDateDebut(), a.getDateFin(), a.isTousUsages(),
                        a.getUsages().stream().sorted(java.util.Comparator.comparing(com.assurance.entity.Usage::getCode))
                                .map(u -> new com.assurance.dto.response.SpecialitePrestataireResponse.Reference(
                                        u.getId(), u.getCode() + " · " + u.getLibelle())).toList())).toList();
    }

    private List<com.assurance.dto.response.SpecialitePrestataireResponse.Reference> domainResponses(java.util.Set<com.assurance.entity.DomaineInterventionSinistre> items) {
        return items.stream().sorted(java.util.Comparator.comparing(com.assurance.entity.DomaineInterventionSinistre::getLibelle))
                .map(d -> new com.assurance.dto.response.SpecialitePrestataireResponse.Reference(d.getId(), d.getLibelle())).toList();
    }

    private SinistreIntervenantResponse toResponse(com.assurance.entity.PrestataireMedicalSinistre provider) {
        return SinistreIntervenantResponse.builder().id(provider.getId()).code(provider.getCode()).nom(provider.getNom())
                .telephone(provider.getTelephone()).email(provider.getEmail()).adresse(provider.getAdresse())
                .villeId(provider.getVille() == null ? null : provider.getVille().getId())
                .ville(provider.getVille() == null ? null : provider.getVille().getNom()).actif(provider.isActif())
                .typePrestataire(provider.getTypePrestataire()).toutesCompagnies(provider.isToutesCompagnies())
                .domaines(domainResponses(provider.getDomaines()))
                .specialites(provider.getSpecialites().stream().map(prestataireService::specialiteResponse).toList())
                .accords(accordResponses(provider.getAccords())).build();
    }

    @Transactional
    public SinistreIntervenantResponse saveMedical(Long agenceId, Long id, com.assurance.dto.request.UpsertPrestataireMedicalRequest request) {
        var type = request.getTypePrestataire();
        if (type == null || type == com.assurance.enums.TypePrestataireSinistre.GARAGE || type == com.assurance.enums.TypePrestataireSinistre.EXPERT) {
            throw new BadRequestException("Utilisez la fiche garage ou expert pour cet opérateur");
        }
        String code = normalizeCode(request.getCode());
        if (medicalRepository.existsByAgenceIdAndCodeIgnoreCaseAndIdNot(agenceId, code, id == null ? 0L : id)) {
            throw new BadRequestException("Ce code prestataire existe déjà dans l'agence");
        }
        var provider = id == null ? com.assurance.entity.PrestataireMedicalSinistre.builder().agence(resolveAgency(agenceId)).typePrestataire(type).build()
                : medicalRepository.findByIdAndAgenceId(id, agenceId).orElseThrow(() -> new ResourceNotFoundException("Prestataire", id));
        if (provider.getTypePrestataire() != type) throw new BadRequestException("Le type d'un prestataire existant ne peut pas changer");
        var before = id == null ? java.util.Map.<String, String>of() : ClaimActivity.intervenantSnapshot(toResponse(provider));
        provider.setCode(code);
        provider.setNom(request.getNom().trim());
        provider.setTelephone(trimToNull(request.getTelephone()));
        provider.setEmail(trimToNull(request.getEmail()));
        provider.setAdresse(trimToNull(request.getAdresse()));
        provider.setVille(resolveVille(request.getVilleId()));
        provider.setActif(request.getActif() == null || request.getActif());
        prestataireService.configure(provider, request);
        provider = medicalRepository.save(provider);
        var response = toResponse(provider);
        activityRecorder.record(new com.assurance.activity.ActivityCommand(agenceId, com.assurance.activity.ActivityModule.SINISTRES,
                id == null ? com.assurance.activity.ActivityAction.CREATED : com.assurance.activity.ActivityAction.UPDATED,
                "Prestataire médical enregistré", "CLAIM_MEDICAL_PROVIDER",
                new com.assurance.activity.ActivityReference(ActivityRecordType.REFERENTIEL, "PRESTATAIRE_MEDICAL:" + provider.getId(), provider.getNom()),
                List.of(), com.assurance.activity.ActivityValues.changes(before, ClaimActivity.intervenantSnapshot(response))));
        return response;
    }

    @Transactional(readOnly = true)
    public List<SinistreIntervenantResponse> eligible(Long agenceId, com.assurance.enums.TypePrestataireSinistre type,
            Long sinistreId, Long contratId, Long vehiculeId, java.time.LocalDate dateSinistre,
            java.util.Set<Long> garantieIds, java.time.LocalDate dateIntervention,
            com.assurance.enums.ModeReparationSinistre mode) {
        return eligible(type, prestataireService.context(agenceId, sinistreId, contratId, vehiculeId,
                dateSinistre, garantieIds, dateIntervention, mode));
    }

    @Transactional(readOnly = true)
    public List<SinistreIntervenantResponse> eligible(com.assurance.enums.TypePrestataireSinistre type,
            PrestataireSinistreService.Eligibility context) {
        if (type == com.assurance.enums.TypePrestataireSinistre.EXPERT) {
            return prestataireService.eligibleExperts(context).stream().map(this::toResponse).toList();
        }
        if (type != com.assurance.enums.TypePrestataireSinistre.GARAGE) {
            throw new BadRequestException("La désignation médicale dans un dossier nécessite un parcours dédié ; cet opérateur est géré dans l'annuaire");
        }
        return prestataireService.eligibleGarages(context).stream().map(garage -> {
            var response = toResponse(garage);
            response.setConventionne(prestataireService.approved(garage.getAccords(), context));
            return response;
        }).toList();
    }

    @Transactional(readOnly = true)
    public com.assurance.dto.response.PagedResponse<SinistreIntervenantResponse> directory(Long agenceId,
            com.assurance.enums.TypePrestataireSinistre type, boolean includeInactive, String query,
            Long villeId, Long compagnieId, Long specialiteId, Long brancheId, Long domaineId, int page, int size) {
        prestataireService.validateDirectorySpecialty(agenceId, type, specialiteId, brancheId);
        if (domaineId != null) {
            var domain = domaines.require(agenceId, domaineId);
            if (!domain.getOperateurs().contains(type)) throw new BadRequestException("Opérateur incompatible avec le domaine sélectionné");
            if (specialiteId != null && prestataireService.specialites(agenceId).stream().noneMatch(s -> s.id().equals(specialiteId)
                    && s.domaines().stream().anyMatch(d -> d.id().equals(domaineId)))) {
                throw new BadRequestException("La spécialité ne couvre pas le domaine sélectionné");
            }
        }
        var pageable = org.springframework.data.domain.PageRequest.of(Math.max(0, page), Math.min(100, Math.max(1, size)),
                org.springframework.data.domain.Sort.by(type == com.assurance.enums.TypePrestataireSinistre.GARAGE ? "raisonSociale" : "nom")
                        .and(org.springframework.data.domain.Sort.by("id")));
        org.springframework.data.domain.Page<SinistreIntervenantResponse> result;
        if (type == com.assurance.enums.TypePrestataireSinistre.EXPERT) {
            result = expertRepository.findAll(directoryFilter(agenceId, includeInactive, query, villeId, compagnieId, specialiteId, brancheId, domaineId, null, "nom"), pageable).map(this::toResponse);
        } else if (type == com.assurance.enums.TypePrestataireSinistre.GARAGE) {
            result = garageRepository.findAll(directoryFilter(agenceId, includeInactive, query, villeId, compagnieId, specialiteId, brancheId, domaineId, null, "raisonSociale"), pageable).map(this::toResponse);
        } else {
            result = medicalRepository.findAll(directoryFilter(agenceId, includeInactive, query, villeId, compagnieId, specialiteId, brancheId, domaineId, type, "nom"), pageable).map(this::toResponse);
        }
        return com.assurance.dto.response.PagedResponse.<SinistreIntervenantResponse>builder()
                .items(result.getContent()).page(com.assurance.dto.response.PageMetadata.from(result)).build();
    }

    @Transactional(readOnly = true)
    public com.assurance.dto.response.PagedResponse<SinistreIntervenantResponse> directoryAll(Long agenceId,
            boolean includeInactive, String query, Long villeId, Long compagnieId, Long specialiteId,
            Long brancheId, Long domaineId, int page, int size) {
        if (specialiteId != null) throw new BadRequestException("Sélectionnez l'opérateur de la spécialité");
        if (domaineId != null) domaines.require(agenceId, domaineId);
        var pageable = org.springframework.data.domain.PageRequest.of(Math.max(0, page), Math.min(100, Math.max(1, size)));
        var result = directoryRepository.search(new com.assurance.repository.PrestataireDirectoryRepository.Filter(
                agenceId, includeInactive, query, villeId, compagnieId, brancheId, domaineId), pageable);
        var responses = new java.util.HashMap<com.assurance.repository.PrestataireDirectoryRepository.ProviderKey, SinistreIntervenantResponse>();
        var expertIds = result.stream().filter(key -> key.type() == com.assurance.enums.TypePrestataireSinistre.EXPERT)
                .map(com.assurance.repository.PrestataireDirectoryRepository.ProviderKey::id).toList();
        var garageIds = result.stream().filter(key -> key.type() == com.assurance.enums.TypePrestataireSinistre.GARAGE)
                .map(com.assurance.repository.PrestataireDirectoryRepository.ProviderKey::id).toList();
        var medicalIds = result.stream().filter(key -> key.type() != com.assurance.enums.TypePrestataireSinistre.GARAGE
                        && key.type() != com.assurance.enums.TypePrestataireSinistre.EXPERT)
                .map(com.assurance.repository.PrestataireDirectoryRepository.ProviderKey::id).toList();
        var loaded = new java.util.ArrayList<SinistreIntervenantResponse>();
        if (!expertIds.isEmpty()) expertRepository.findByAgenceIdAndIdIn(agenceId, expertIds).stream().map(this::toResponse).forEach(loaded::add);
        if (!garageIds.isEmpty()) garageRepository.findByAgenceIdAndIdIn(agenceId, garageIds).stream().map(this::toResponse).forEach(loaded::add);
        if (!medicalIds.isEmpty()) medicalRepository.findByAgenceIdAndIdIn(agenceId, medicalIds).stream().map(this::toResponse).forEach(loaded::add);
        loaded.forEach(response -> responses.put(new com.assurance.repository.PrestataireDirectoryRepository.ProviderKey(
                response.getTypePrestataire(), response.getId()), response));
        var content = result.getContent().stream().map(key -> java.util.Objects.requireNonNull(responses.get(key),
                "Prestataire introuvable dans le périmètre de l'agence")).toList();
        return com.assurance.dto.response.PagedResponse.<SinistreIntervenantResponse>builder().items(content)
                .page(com.assurance.dto.response.PageMetadata.from(result)).build();
    }

    private <T> org.springframework.data.jpa.domain.Specification<T> directoryFilter(Long agenceId, boolean includeInactive,
            String query, Long villeId, Long compagnieId, Long specialiteId, Long brancheId, Long domaineId, com.assurance.enums.TypePrestataireSinistre medicalType, String nameField) {
        return (root, criteria, cb) -> {
            var predicates = new java.util.ArrayList<jakarta.persistence.criteria.Predicate>();
            predicates.add(cb.equal(root.get("agence").get("id"), agenceId));
            if (medicalType != null) predicates.add(cb.equal(root.get("typePrestataire"), medicalType));
            if (!includeInactive) predicates.add(cb.isTrue(root.get("actif")));
            if (villeId != null) predicates.add(cb.equal(root.get("ville").get("id"), villeId));
            if (compagnieId != null) {
                var agreement = root.join("accords", jakarta.persistence.criteria.JoinType.LEFT);
                predicates.add(cb.or(cb.isTrue(root.get("toutesCompagnies")), cb.and(
                        cb.equal(agreement.get("agence").get("id"), agenceId), cb.equal(agreement.get("compagnie").get("id"), compagnieId),
                        cb.isTrue(agreement.get("actif")), cb.or(cb.isNull(agreement.get("dateDebut")), cb.lessThanOrEqualTo(agreement.get("dateDebut"), java.time.LocalDate.now())),
                        cb.or(cb.isNull(agreement.get("dateFin")), cb.greaterThanOrEqualTo(agreement.get("dateFin"), java.time.LocalDate.now())))));
            }
            if (domaineId != null) {
                var directDomain = root.join("domaines", jakarta.persistence.criteria.JoinType.LEFT);
                var specialty = root.join("specialites", jakarta.persistence.criteria.JoinType.LEFT);
                var specialtyDomain = specialty.join("domaines", jakarta.persistence.criteria.JoinType.LEFT);
                var directMatches = cb.and(cb.equal(directDomain.get("id"), domaineId), cb.equal(directDomain.get("agence").get("id"), agenceId));
                var specialtyMatches = cb.and(cb.equal(specialtyDomain.get("id"), domaineId), cb.equal(specialty.get("agence").get("id"), agenceId), cb.isTrue(specialty.get("actif")));
                if (specialiteId == null) predicates.add(cb.or(directMatches, specialtyMatches));
                else predicates.add(cb.and(specialtyMatches, cb.equal(specialty.get("id"), specialiteId)));
            }
            if (specialiteId != null || brancheId != null) {
                var specialty = root.join("specialites");
                predicates.add(cb.equal(specialty.get("agence").get("id"), agenceId));
                predicates.add(cb.isTrue(specialty.get("actif")));
                if (specialiteId != null) predicates.add(cb.equal(specialty.get("id"), specialiteId));
                if (brancheId != null) {
                    var guarantee = specialty.join("garanties");
                    predicates.add(cb.equal(guarantee.get("brancheAssurance").get("id"), brancheId));
                    predicates.add(cb.isTrue(guarantee.get("actif")));
                }
            }
            if (query != null && !query.isBlank()) {
                String pattern = "%" + query.trim().toLowerCase(Locale.ROOT).replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%";
                predicates.add(cb.or(cb.like(cb.lower(root.get("code")), pattern, '!'), cb.like(cb.lower(root.get(nameField)), pattern, '!'),
                        cb.like(cb.lower(root.get("telephone")), pattern, '!'), cb.like(cb.lower(root.get("email")), pattern, '!')));
            }
            criteria.distinct(true);
            return cb.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
    }

    private String normalizeCode(String value) {
        String code = value.trim().toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9_-]", "_");
        if (code.isBlank()) {
            throw new BadRequestException("Le code doit contenir au moins un caractère alphanumérique");
        }
        return code;
    }

    private String trimToNull(String value) {
        return value == null || value.trim().isEmpty() ? null : value.trim();
    }
}
