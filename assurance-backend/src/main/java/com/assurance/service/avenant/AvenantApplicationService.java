package com.assurance.service.avenant;

import com.assurance.dto.request.AvenantRequest;
import com.assurance.dto.response.AvenantContextResponse;
import com.assurance.dto.response.AvenantDetailResponse;
import com.assurance.dto.response.AvenantDraftResponse;
import com.assurance.dto.response.ContratActionsResponse;
import com.assurance.dto.response.ContratResponse;
import com.assurance.dto.response.QuittanceResponse;
import com.assurance.exception.BadRequestException;
import com.assurance.service.AvenantDraftService;
import com.assurance.service.ContratActionService;
import com.assurance.service.ContratService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class AvenantApplicationService {

    private final ContratService contratService;
    private final AvenantDraftService avenantDraftService;
    private final ContratActionService contratActionService;
    private final AvenantTypeCatalog avenantTypeCatalog;

    @Transactional(readOnly = true)
    public AvenantContextResponse getContext(Long agenceId, Long contratId) {
        ContratResponse contrat = contratService.getAvenantContext(agenceId, contratId);
        ContratActionsResponse actions = contratActionService.getActions(agenceId, contratId);
        return AvenantContextResponse.builder()
                .contrat(contrat)
                .mouvementsDisponibles(actions.getMouvementsDisponibles())
                .build();
    }

    @Transactional(readOnly = true)
    public List<ContratActionsResponse.MouvementDisponible> getAvailableTypes(Long agenceId, Long contratId) {
        return contratActionService.getActions(agenceId, contratId).getMouvementsDisponibles();
    }

    @Transactional(readOnly = true)
    public AvenantDetailResponse getDetail(Long agenceId, Long contratId, Long mouvementId) {
        return contratService.getAvenantDetail(agenceId, contratId, mouvementId);
    }

    @Transactional(readOnly = true)
    public AvenantDraftResponse getDraft(Long agenceId, Long contratId, String code) {
        return avenantDraftService.get(agenceId, contratId, normalizeCode(code));
    }

    @Transactional
    public AvenantDraftResponse saveDraft(Long agenceId, Long contratId, String code, AvenantRequest request) {
        bindCode(code, request);
        avenantTypeCatalog.validateDraft(code, request);
        return avenantDraftService.save(agenceId, contratId, request);
    }

    @Transactional
    public void deleteDraft(Long agenceId, Long contratId, String code) {
        avenantDraftService.delete(agenceId, contratId, normalizeCode(code));
    }

    @Transactional(readOnly = true)
    public AvenantRequest getRectification(Long agenceId, Long contratId, Long mouvementId) {
        return contratService.getAvenantRectification(agenceId, contratId, mouvementId);
    }

    @Transactional
    public QuittanceResponse rectify(
            Long agenceId,
            Long contratId,
            Long mouvementId,
            String code,
            AvenantRequest request
    ) {
        bindCode(code, request);
        avenantTypeCatalog.validateCommand(code, request);
        return contratService.rectifierAvenant(agenceId, contratId, mouvementId, request);
    }

    @Transactional(readOnly = true)
    public QuittanceResponse preview(
            Long agenceId,
            Long contratId,
            String code,
            AvenantRequest request,
            Long mouvementId
    ) {
        bindCode(code, request);
        avenantTypeCatalog.validateCommand(code, request);
        return contratService.previsualiserAvenant(agenceId, contratId, request, mouvementId);
    }

    @Transactional
    public QuittanceResponse create(Long agenceId, Long contratId, String code, AvenantRequest request) {
        bindCode(code, request);
        avenantTypeCatalog.validateCommand(code, request);
        return contratService.creerAvenant(agenceId, contratId, request);
    }

    @Transactional(readOnly = true)
    public QuittanceResponse previewLegacy(
            Long agenceId,
            Long contratId,
            AvenantRequest request,
            Long mouvementId
    ) {
        requireBodyCode(request);
        avenantTypeCatalog.validateCommand(request.getCodeTypeMouvement(), request);
        return contratService.previsualiserAvenant(agenceId, contratId, request, mouvementId);
    }

    @Transactional
    public QuittanceResponse createLegacy(Long agenceId, Long contratId, AvenantRequest request) {
        requireBodyCode(request);
        avenantTypeCatalog.validateCommand(request.getCodeTypeMouvement(), request);
        return contratService.creerAvenant(agenceId, contratId, request);
    }

    private void bindCode(String pathCode, AvenantRequest request) {
        if (request == null) {
            throw new BadRequestException("Les donnees de l'avenant sont obligatoires");
        }
        String code = normalizeCode(pathCode);
        if (request.getCodeTypeMouvement() != null
                && !request.getCodeTypeMouvement().isBlank()
                && !code.equals(normalizeCode(request.getCodeTypeMouvement()))) {
            throw new BadRequestException("Le type d'avenant de l'URL ne correspond pas au contenu de la requete");
        }
        request.setCodeTypeMouvement(code);
    }

    private void requireBodyCode(AvenantRequest request) {
        if (request == null || request.getCodeTypeMouvement() == null || request.getCodeTypeMouvement().isBlank()) {
            throw new BadRequestException("Le type d'avenant est obligatoire");
        }
        request.setCodeTypeMouvement(normalizeCode(request.getCodeTypeMouvement()));
    }

    private String normalizeCode(String code) {
        if (code == null || code.isBlank()) {
            throw new BadRequestException("Le type d'avenant est obligatoire");
        }
        return code.trim().toUpperCase(Locale.ROOT);
    }
}
