package com.assurance.service;

import com.assurance.dto.request.CreateSinistreRequest;
import com.assurance.dto.request.InitialSinistreDocumentRequest;
import com.assurance.dto.response.SinistreDetailResponse;
import com.assurance.enums.PhaseExpertiseSinistre;
import com.assurance.exception.BadRequestException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@Service
@RequiredArgsConstructor
public class SinistreOuvertureService {
    private final SinistreService sinistreService;
    private final SinistreDossierService dossierService;
    private final SinistreDocumentService documentService;
    private final jakarta.validation.Validator validator;

    @Transactional
    public SinistreDetailResponse ouvrir(Long agenceId, Long utilisateurId, CreateSinistreRequest request,
            List<InitialSinistreDocumentRequest> documents, List<MultipartFile> files) {
        List<InitialSinistreDocumentRequest> metadata = documents == null ? List.of() : documents;
        List<MultipartFile> uploads = files == null ? List.of() : files;
        if (metadata.size() != uploads.size()) {
            throw new BadRequestException("Chaque fichier initial doit avoir ses metadonnees dans le meme ordre");
        }
        for (InitialSinistreDocumentRequest document : metadata) {
            if (document == null || document.getType() == null || !java.util.Set.of(
                    com.assurance.enums.TypeDocumentSinistre.DECLARATION,
                    com.assurance.enums.TypeDocumentSinistre.CONSTAT,
                    com.assurance.enums.TypeDocumentSinistre.PV_POLICE).contains(document.getType())) {
                throw new BadRequestException("L'ouverture accepte uniquement declaration, constat et PV de police");
            }
            var violations = validator.validate(document);
            if (!violations.isEmpty()) {
                throw new BadRequestException(violations.stream()
                        .map(violation -> violation.getPropertyPath() + " : " + violation.getMessage())
                        .sorted().collect(java.util.stream.Collectors.joining(". ")));
            }
        }
        if (request.getExpertInitial() != null && request.getExpertInitial().getPhase() != PhaseExpertiseSinistre.AVANT) {
            throw new BadRequestException("L'expertise initiale doit etre de phase AVANT");
        }
        SinistreDetailResponse detail = sinistreService.create(agenceId, utilisateurId, request);
        if (request.getExpertInitial() != null) {
            dossierService.saveMission(agenceId, utilisateurId, detail.getId(), null, request.getExpertInitial());
        }
        for (int index = 0; index < metadata.size(); index++) {
            InitialSinistreDocumentRequest document = metadata.get(index);
            documentService.upload(agenceId, utilisateurId, detail.getId(), document.getType(),
                    document.getDateDocument(), document.getReference(), document.getMontant(), document.getEmetteur(),
                    null, null, null, document.getCommentaire(), uploads.get(index));
        }
        return sinistreService.get(agenceId, detail.getId());
    }
}
