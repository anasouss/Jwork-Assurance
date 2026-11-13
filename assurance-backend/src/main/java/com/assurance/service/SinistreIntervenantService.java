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
                .accords(accordResponses(garage.getAccords()))
                .build();
    }

    private List<SinistreIntervenantResponse.Accord> accordResponses(java.util.Set<com.assurance.entity.AccordPrestataireSinistre> agreements) {
        return agreements.stream().sorted(java.util.Comparator.comparing(a -> a.getCompagnie().getNom()))
                .map(a -> new SinistreIntervenantResponse.Accord(a.getCompagnie().getId(), a.getCompagnie().getNom(),
                        a.isActif(), a.isConventionne(), a.getDateDebut(), a.getDateFin())).toList();
    }

    @Transactional(readOnly = true)
    public List<SinistreIntervenantResponse> eligible(Long agenceId, com.assurance.enums.TypePrestataireSinistre type,
            Long sinistreId, Long contratId, Long vehiculeId, java.time.LocalDate dateSinistre,
            java.util.Set<Long> garantieIds, java.time.LocalDate dateIntervention,
            com.assurance.enums.ModeReparationSinistre mode, Long villeId) {
        return eligible(type, prestataireService.context(agenceId, sinistreId, contratId, vehiculeId,
                dateSinistre, garantieIds, dateIntervention, mode), villeId);
    }

    @Transactional(readOnly = true)
    public List<SinistreIntervenantResponse> eligible(com.assurance.enums.TypePrestataireSinistre type,
            PrestataireSinistreService.Eligibility context, Long villeId) {
        if (type == com.assurance.enums.TypePrestataireSinistre.EXPERT) {
            return prestataireService.eligibleExperts(context, villeId).stream().map(this::toResponse).toList();
        }
        return prestataireService.eligibleGarages(context, villeId).stream().map(garage -> {
            var response = toResponse(garage);
            response.setConventionne(prestataireService.approved(garage.getAccords(), context));
            return response;
        }).toList();
    }

    @Transactional(readOnly = true)
    public com.assurance.dto.response.PagedResponse<SinistreIntervenantResponse> directory(Long agenceId,
            com.assurance.enums.TypePrestataireSinistre type, boolean includeInactive, String query,
            Long villeId, Long compagnieId, Long specialiteId, int page, int size) {
        var pageable = org.springframework.data.domain.PageRequest.of(Math.max(0, page), Math.min(100, Math.max(1, size)),
                org.springframework.data.domain.Sort.by(type == com.assurance.enums.TypePrestataireSinistre.EXPERT ? "nom" : "raisonSociale").and(org.springframework.data.domain.Sort.by("id")));
        org.springframework.data.domain.Page<SinistreIntervenantResponse> result;
        if (type == com.assurance.enums.TypePrestataireSinistre.EXPERT) {
            result = expertRepository.findAll(directoryFilter(agenceId, includeInactive, query, villeId, compagnieId, specialiteId, "nom"), pageable).map(this::toResponse);
        } else {
            result = garageRepository.findAll(directoryFilter(agenceId, includeInactive, query, villeId, compagnieId, specialiteId, "raisonSociale"), pageable).map(this::toResponse);
        }
        return com.assurance.dto.response.PagedResponse.<SinistreIntervenantResponse>builder()
                .items(result.getContent()).page(com.assurance.dto.response.PageMetadata.from(result)).build();
    }

    private <T> org.springframework.data.jpa.domain.Specification<T> directoryFilter(Long agenceId, boolean includeInactive,
            String query, Long villeId, Long compagnieId, Long specialiteId, String nameField) {
        return (root, criteria, cb) -> {
            var predicates = new java.util.ArrayList<jakarta.persistence.criteria.Predicate>();
            predicates.add(cb.equal(root.get("agence").get("id"), agenceId));
            if (!includeInactive) predicates.add(cb.isTrue(root.get("actif")));
            if (villeId != null) predicates.add(cb.equal(root.get("ville").get("id"), villeId));
            if (compagnieId != null) predicates.add(cb.equal(root.join("accords").get("compagnie").get("id"), compagnieId));
            if (specialiteId != null) predicates.add(cb.equal(root.join("specialites").get("id"), specialiteId));
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
