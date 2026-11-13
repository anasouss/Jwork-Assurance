package com.assurance.service;

import com.assurance.activity.ActivityAction;
import com.assurance.activity.AmendmentActivity;
import com.assurance.activity.BusinessActivityRecorder;
import com.assurance.dto.request.AvenantDraftContext;
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
import java.util.Collection;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AvenantDraftService {

    private final AvenantDraftRepository avenantDraftRepository;
    private final ContratRepository contratRepository;
    private final MouvementContratService mouvementContratService;
    private final ObjectMapper objectMapper;
    private final AmendmentActivity amendmentActivity;
    private final BusinessActivityRecorder businessActivityRecorder;

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

    @Transactional(readOnly = true)
    public List<AvenantDraftSummaryResponse> listSummaries(Long agenceId, Collection<Long> contratIds) {
        if (contratIds == null || contratIds.isEmpty()) {
            return List.of();
        }
        return avenantDraftRepository
                .findByAgenceIdAndContratIdInOrderByUpdatedAtDesc(agenceId, contratIds)
                .stream()
                .map(this::toSummaryResponse)
                .toList();
    }

    @Transactional
    public AvenantDraftResponse save(Long agenceId, Long contratId, AvenantRequest request) {
        return save(agenceId, contratId, request, new AvenantDraftContext());
    }

    @Transactional
    public AvenantDraftResponse save(Long agenceId, Long contratId, AvenantRequest request, AvenantDraftContext context) {
        if (request == null) {
            throw new BadRequestException("Le brouillon d'avenant est obligatoire");
        }
        if (request.getLibelleReleve() != null) {
            String label = request.getLibelleReleve().replaceAll("[\\r\\n]+", " ").trim();
            if (label.length() > 180) {
                throw new BadRequestException("Le libellé du relevé ne doit pas dépasser 180 caractères");
            }
            request.setLibelleReleve(label.isBlank() ? null : label);
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
        context.validate(request,
                (int) contrat.getVehicules().stream().filter(v -> !Boolean.FALSE.equals(v.getActif())).count(),
                (int) contrat.getRemorques().stream().filter(r -> !Boolean.FALSE.equals(r.getActif())).count());

        AvenantDraft draft = avenantDraftRepository
                .findByAgenceIdAndContratIdAndTypeMouvementCodeIgnoreCase(agenceId, contratId, code)
                .orElseGet(() -> AvenantDraft.builder()
                        .agence(contrat.getAgence())
                        .contrat(contrat)
                        .typeMouvement(typeMouvement)
                        .build());
        boolean created = draft.getId() == null;
        Map<String, String> before = created ? Map.of() : amendmentActivity.snapshot(read(draft.getPayloadJson()), contrat);
        draft.setPayloadJson(write(request));
        draft = avenantDraftRepository.save(draft);
        businessActivityRecorder.record(amendmentActivity.draftCommand(draft, before,
                amendmentActivity.snapshot(read(draft.getPayloadJson()), contrat),
                created ? ActivityAction.CREATED : ActivityAction.SAVED, context.title(),
                "AMENDMENT_DRAFT_" + context.getIntent().name(), request));
        return toResponse(draft);
    }

    @Transactional
    public void delete(Long agenceId, Long contratId, String codeTypeMouvement) {
        requireCode(codeTypeMouvement);
        Contrat contrat = requireContrat(agenceId, contratId);
        avenantDraftRepository
                .findByAgenceIdAndContratIdAndTypeMouvementCodeIgnoreCase(agenceId, contratId, codeTypeMouvement)
                .ifPresent(draft -> {
                    AvenantRequest request = read(draft.getPayloadJson());
                    var command = amendmentActivity.draftCommand(draft, amendmentActivity.snapshot(request, contrat), Map.of(),
                            ActivityAction.DELETED, "Brouillon d'avenant supprimé", "AMENDMENT_DRAFT_DELETION", request);
                    avenantDraftRepository.delete(draft);
                    businessActivityRecorder.record(command);
                });
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
