package com.assurance.service;

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

    @Transactional(readOnly = true)
    public List<SinistreIntervenantResponse> listExperts(Long agenceId, boolean includeInactive) {
        List<ExpertSinistre> experts = includeInactive
                ? expertRepository.findByAgenceIdOrderByNomAsc(agenceId)
                : expertRepository.findByAgenceIdAndActifTrueOrderByNomAsc(agenceId);
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
        expert.setCode(code);
        expert.setNom(request.getNom().trim());
        expert.setTelephone(trimToNull(request.getTelephone()));
        expert.setEmail(trimToNull(request.getEmail()));
        expert.setAdresse(trimToNull(request.getAdresse()));
        expert.setVille(resolveVille(request.getVilleId()));
        expert.setActif(request.getActif() == null || request.getActif());
        return toResponse(expertRepository.save(expert));
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
        garage.setCode(code);
        garage.setRaisonSociale(request.getRaisonSociale().trim());
        garage.setTelephone(trimToNull(request.getTelephone()));
        garage.setEmail(trimToNull(request.getEmail()));
        garage.setAdresse(trimToNull(request.getAdresse()));
        garage.setVille(resolveVille(request.getVilleId()));
        garage.setActif(request.getActif() == null || request.getActif());
        return toResponse(garageRepository.save(garage));
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
                .build();
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
