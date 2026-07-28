package com.assurance.service;

import com.assurance.dto.request.AvenantRequest;
import com.assurance.dto.response.AvenantDraftResponse;
import com.assurance.dto.response.AvenantDraftSummaryResponse;
import com.assurance.entity.AvenantDraft;
import com.assurance.entity.Contrat;
import com.assurance.entity.TypeMouvementContrat;
import com.assurance.enums.StatutContrat;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.AvenantDraftRepository;
import com.assurance.repository.ContratRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AvenantDraftService {

    private final AvenantDraftRepository avenantDraftRepository;
    private final ContratRepository contratRepository;
    private final MouvementContratService mouvementContratService;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public AvenantDraftResponse get(Long agenceId, Long contratId, String codeTypeMouvement) {
        requireCode(codeTypeMouvement);
        requireContrat(agenceId, contratId);
        return avenantDraftRepository
                .findByAgenceIdAndContratIdAndTypeMouvementCodeIgnoreCase(agenceId, contratId, codeTypeMouvement)
                .map(this::toResponse)
                .orElse(null);
    }

    @Transactional(readOnly = true)
    public List<AvenantDraftSummaryResponse> listSummaries(Long agenceId) {
        return avenantDraftRepository.findByAgenceIdOrderByUpdatedAtDesc(agenceId).stream()
                .map(this::toSummaryResponse)
                .toList();
    }

    @Transactional
    public AvenantDraftResponse save(Long agenceId, Long contratId, AvenantRequest request) {
        if (request == null) {
            throw new BadRequestException("Le brouillon d'avenant est obligatoire");
        }
        String code = requireCode(request.getCodeTypeMouvement());
        Contrat contrat = requireContrat(agenceId, contratId);
        if (Boolean.TRUE.equals(contrat.getBrouillon())
                || Boolean.TRUE.equals(contrat.getProspection())
                || contrat.getStatut() != StatutContrat.ACTIVE) {
            throw new BadRequestException("Le contrat doit etre actif pour enregistrer un brouillon d'avenant");
        }
        TypeMouvementContrat typeMouvement = mouvementContratService.resolveTypeMouvementPourContrat(code, contrat.getTypeContrat());
        request.setCodeTypeMouvement(typeMouvement.getCode());
        request.setDateEcheance(contrat.getDateEcheance());

        AvenantDraft draft = avenantDraftRepository
                .findByAgenceIdAndContratIdAndTypeMouvementCodeIgnoreCase(agenceId, contratId, code)
                .orElseGet(() -> AvenantDraft.builder()
                        .agence(contrat.getAgence())
                        .contrat(contrat)
                        .typeMouvement(typeMouvement)
                        .build());
        draft.setPayloadJson(write(request));
        return toResponse(avenantDraftRepository.save(draft));
    }

    @Transactional
    public void delete(Long agenceId, Long contratId, String codeTypeMouvement) {
        requireCode(codeTypeMouvement);
        requireContrat(agenceId, contratId);
        avenantDraftRepository
                .findByAgenceIdAndContratIdAndTypeMouvementCodeIgnoreCase(agenceId, contratId, codeTypeMouvement)
                .ifPresent(avenantDraftRepository::delete);
    }

    private Contrat requireContrat(Long agenceId, Long contratId) {
        return contratRepository.findByAgenceIdAndId(agenceId, contratId)
                .orElseThrow(() -> new ResourceNotFoundException("Contrat", contratId));
    }

    private String requireCode(String codeTypeMouvement) {
        if (codeTypeMouvement == null || codeTypeMouvement.isBlank()) {
            throw new BadRequestException("Le type d'avenant est obligatoire");
        }
        return codeTypeMouvement.trim().toUpperCase();
    }

    private String write(AvenantRequest request) {
        try {
            return objectMapper.writeValueAsString(request);
        } catch (JsonProcessingException exception) {
            throw new BadRequestException("Le brouillon d'avenant ne peut pas etre enregistre");
        }
    }

    private AvenantRequest read(String payload) {
        try {
            return objectMapper.readValue(payload, AvenantRequest.class);
        } catch (JsonProcessingException exception) {
            throw new BadRequestException("Le brouillon d'avenant enregistre est invalide");
        }
    }

    private AvenantDraftResponse toResponse(AvenantDraft draft) {
        return AvenantDraftResponse.builder()
                .id(draft.getId())
                .contratId(draft.getContrat().getId())
                .codeTypeMouvement(draft.getTypeMouvement().getCode())
                .updatedAt(draft.getUpdatedAt())
                .request(read(draft.getPayloadJson()))
                .build();
    }

    private AvenantDraftSummaryResponse toSummaryResponse(AvenantDraft draft) {
        AvenantRequest request = read(draft.getPayloadJson());
        return AvenantDraftSummaryResponse.builder()
                .id(draft.getId())
                .contratId(draft.getContrat().getId())
                .codeTypeMouvement(draft.getTypeMouvement().getCode())
                .libelleTypeMouvement(draft.getTypeMouvement().getLibelle())
                .dateEffet(request.getDateEffet())
                .dateEcheance(request.getDateEcheance())
                .updatedAt(draft.getUpdatedAt())
                .build();
    }
}
