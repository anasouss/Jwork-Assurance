package com.assurance.service;

import com.assurance.dto.request.AddProvisionSinistreRequest;
import com.assurance.dto.request.AddSinistreOperationRequest;
import com.assurance.dto.request.AddSinistrePartieRequest;
import com.assurance.dto.request.UpdateSinistreGarantieRequest;
import com.assurance.dto.request.UpsertMissionExpertiseRequest;
import com.assurance.dto.response.SinistreDetailResponse;
import com.assurance.entity.ExpertSinistre;
import com.assurance.entity.GarageSinistre;
import com.assurance.entity.MissionExpertise;
import com.assurance.entity.ProvisionSinistre;
import com.assurance.entity.Sinistre;
import com.assurance.entity.SinistreGarantie;
import com.assurance.entity.SinistreOperation;
import com.assurance.entity.SinistrePartie;
import com.assurance.entity.Utilisateur;
import com.assurance.enums.DecisionCouvertureSinistre;
import com.assurance.enums.StatutSinistre;
import com.assurance.enums.TypeEvenementSinistre;
import com.assurance.enums.TypeOperationSinistre;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.ExpertSinistreRepository;
import com.assurance.repository.GarageSinistreRepository;
import com.assurance.repository.MissionExpertiseRepository;
import com.assurance.repository.ProvisionSinistreRepository;
import com.assurance.repository.SinistreGarantieRepository;
import com.assurance.repository.SinistreOperationRepository;
import com.assurance.repository.SinistrePartieRepository;
import com.assurance.repository.SinistreRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

@Service
@RequiredArgsConstructor
public class SinistreDossierService {

    private final SinistreRepository sinistreRepository;
    private final SinistreGarantieRepository garantieRepository;
    private final SinistrePartieRepository partieRepository;
    private final ProvisionSinistreRepository provisionRepository;
    private final SinistreOperationRepository operationRepository;
    private final MissionExpertiseRepository missionRepository;
    private final ExpertSinistreRepository expertRepository;
    private final GarageSinistreRepository garageRepository;
    private final SinistreService sinistreService;
    private final SinistreWorkflowService workflowService;
    private final SinistreEvenementService evenementService;
    private final SinistreResponseMapper responseMapper;

    @Transactional
    public SinistreDetailResponse updateGuarantee(
            Long agenceId,
            Long utilisateurId,
            Long sinistreId,
            Long garantieId,
            UpdateSinistreGarantieRequest request
    ) {
        Context context = context(agenceId, utilisateurId, sinistreId);
        assertEditable(context.sinistre());
        SinistreGarantie garantie = garantieRepository.findByIdAndSinistreId(garantieId, sinistreId)
                .orElseThrow(() -> new ResourceNotFoundException("SinistreGarantie", garantieId));
        garantie.setImpliquee(Boolean.TRUE.equals(request.getImpliquee()));
        garantie.setDecisionCouverture(request.getDecisionCouverture());
        garantie.setFranchiseAppliquee(request.getFranchiseAppliquee());
        garantie.setMontantIndemnisable(request.getMontantIndemnisable());
        if (request.getDecisionCouverture() == DecisionCouvertureSinistre.REFUSEE) {
            garantie.setMontantIndemnisable(null);
        }
        garantieRepository.save(garantie);
        evenementService.record(
                context.sinistre(),
                context.acteur(),
                TypeEvenementSinistre.MODIFICATION,
                "Décision de couverture mise à jour pour la garantie " + garantie.getSnapshotCode()
        );
        return responseMapper.toDetail(context.sinistre());
    }

    @Transactional
    public SinistreDetailResponse addParty(
            Long agenceId,
            Long utilisateurId,
            Long sinistreId,
            AddSinistrePartieRequest request
    ) {
        Context context = context(agenceId, utilisateurId, sinistreId);
        assertEditable(context.sinistre());
        partieRepository.save(SinistrePartie.builder()
                .sinistre(context.sinistre())
                .type(request.getType())
                .nom(request.getNom().trim())
                .telephone(trimToNull(request.getTelephone()))
                .cin(trimToNull(request.getCin()))
                .numeroPermis(trimToNull(request.getNumeroPermis()))
                .immatriculation(trimToNull(request.getImmatriculation()))
                .compagnieAdverse(trimToNull(request.getCompagnieAdverse()))
                .numeroPoliceAdverse(trimToNull(request.getNumeroPoliceAdverse()))
                .notes(trimToNull(request.getNotes()))
                .build());
        evenementService.record(
                context.sinistre(),
                context.acteur(),
                TypeEvenementSinistre.MODIFICATION,
                "Partie impliquée ajoutée : " + request.getNom().trim()
        );
        return responseMapper.toDetail(context.sinistre());
    }

    @Transactional
    public SinistreDetailResponse deleteParty(
            Long agenceId,
            Long utilisateurId,
            Long sinistreId,
            Long partieId
    ) {
        Context context = context(agenceId, utilisateurId, sinistreId);
        assertEditable(context.sinistre());
        SinistrePartie partie = partieRepository.findByIdAndSinistreId(partieId, sinistreId)
                .orElseThrow(() -> new ResourceNotFoundException("SinistrePartie", partieId));
        String nom = partie.getNom();
        partieRepository.delete(partie);
        evenementService.record(
                context.sinistre(),
                context.acteur(),
                TypeEvenementSinistre.MODIFICATION,
                "Partie impliquée retirée : " + nom
        );
        return responseMapper.toDetail(context.sinistre());
    }

    @Transactional
    public SinistreDetailResponse addProvision(
            Long agenceId,
            Long utilisateurId,
            Long sinistreId,
            AddProvisionSinistreRequest request
    ) {
        Context context = context(agenceId, utilisateurId, sinistreId);
        assertEditable(context.sinistre());
        validateDossierDate(context.sinistre(), request.getDateProvision(), "provision");
        provisionRepository.save(ProvisionSinistre.builder()
                .sinistre(context.sinistre())
                .saisiePar(context.acteur())
                .dateProvision(request.getDateProvision())
                .montant(request.getMontant())
                .motif(request.getMotif().trim())
                .build());
        evenementService.record(
                context.sinistre(),
                context.acteur(),
                TypeEvenementSinistre.PROVISION,
                "Provision actualisée à " + request.getMontant()
        );
        return responseMapper.toDetail(context.sinistre());
    }

    @Transactional
    public SinistreDetailResponse saveMission(
            Long agenceId,
            Long utilisateurId,
            Long sinistreId,
            Long missionId,
            UpsertMissionExpertiseRequest request
    ) {
        Context context = context(agenceId, utilisateurId, sinistreId);
        assertEditable(context.sinistre());
        validateNotBeforeSinistre(context.sinistre(), request.getDateMission(), "mission d'expertise");
        if (request.getDateRapport() != null) {
            validateDossierDate(context.sinistre(), request.getDateRapport(), "rapport d'expertise");
            if (request.getDateRapport().isBefore(request.getDateMission())) {
                throw new BadRequestException("La date du rapport ne peut pas précéder la mission");
            }
        }
        ExpertSinistre expert = expertRepository.findByIdAndAgenceId(request.getExpertId(), agenceId)
                .orElseThrow(() -> new ResourceNotFoundException("ExpertSinistre", request.getExpertId()));
        if (!expert.isActif()) {
            throw new BadRequestException("L'expert sélectionné est inactif");
        }
        GarageSinistre garage = request.getGarageId() == null
                ? null
                : garageRepository.findByIdAndAgenceId(request.getGarageId(), agenceId)
                .orElseThrow(() -> new ResourceNotFoundException("GarageSinistre", request.getGarageId()));
        if (garage != null && !garage.isActif()) {
            throw new BadRequestException("Le garage sélectionné est inactif");
        }
        MissionExpertise mission = missionId == null
                ? MissionExpertise.builder().sinistre(context.sinistre()).build()
                : missionRepository.findByIdAndSinistreId(missionId, sinistreId)
                .orElseThrow(() -> new ResourceNotFoundException("MissionExpertise", missionId));
        mission.setExpert(expert);
        mission.setGarage(garage);
        mission.setExpertNomSnapshot(expert.getNom());
        mission.setGarageNomSnapshot(garage == null ? null : garage.getRaisonSociale());
        mission.setReferenceMission(trimToNull(request.getReferenceMission()));
        mission.setDateMission(request.getDateMission());
        mission.setDateRapport(request.getDateRapport());
        mission.setMontantEstime(request.getMontantEstime());
        mission.setMontantAccepte(request.getMontantAccepte());
        mission.setStatut(request.getStatut());
        mission.setNotes(trimToNull(request.getNotes()));
        missionRepository.save(mission);
        evenementService.record(
                context.sinistre(),
                context.acteur(),
                TypeEvenementSinistre.EXPERTISE,
                "Mission d'expertise enregistrée pour " + expert.getNom()
        );
        return responseMapper.toDetail(context.sinistre());
    }

    @Transactional
    public SinistreDetailResponse addOperation(
            Long agenceId,
            Long utilisateurId,
            Long sinistreId,
            AddSinistreOperationRequest request
    ) {
        Context context = context(agenceId, utilisateurId, sinistreId);
        assertEditable(context.sinistre());
        validateDossierDate(context.sinistre(), request.getDateOperation(), "opération financière");
        if (request.getType() == TypeOperationSinistre.ANNULATION) {
            throw new BadRequestException("Utilisez l'action d'annulation d'une opération existante");
        }
        operationRepository.save(SinistreOperation.builder()
                .sinistre(context.sinistre())
                .saisiPar(context.acteur())
                .type(request.getType())
                .dateOperation(request.getDateOperation())
                .montant(request.getMontant())
                .reference(trimToNull(request.getReference()))
                .beneficiaire(trimToNull(request.getBeneficiaire()))
                .modeReglement(trimToNull(request.getModeReglement()))
                .notes(trimToNull(request.getNotes()))
                .build());
        evenementService.record(
                context.sinistre(),
                context.acteur(),
                TypeEvenementSinistre.OPERATION_FINANCIERE,
                "Opération " + request.getType() + " enregistrée pour " + request.getMontant()
        );
        return responseMapper.toDetail(context.sinistre());
    }

    @Transactional
    public SinistreDetailResponse cancelOperation(
            Long agenceId,
            Long utilisateurId,
            Long sinistreId,
            Long operationId,
            String motif
    ) {
        Context context = context(agenceId, utilisateurId, sinistreId);
        assertEditable(context.sinistre());
        SinistreOperation operation = operationRepository.findByIdAndSinistreId(operationId, sinistreId)
                .orElseThrow(() -> new ResourceNotFoundException("SinistreOperation", operationId));
        if (operation.getType() == TypeOperationSinistre.ANNULATION) {
            throw new BadRequestException("Une annulation ne peut pas être annulée");
        }
        if (operationRepository.existsByOperationAnnuleeId(operationId)) {
            throw new BadRequestException("Cette opération est déjà annulée");
        }
        operationRepository.save(SinistreOperation.builder()
                .sinistre(context.sinistre())
                .saisiPar(context.acteur())
                .operationAnnulee(operation)
                .type(TypeOperationSinistre.ANNULATION)
                .dateOperation(LocalDate.now())
                .montant(operation.getMontant())
                .reference(operation.getReference())
                .notes(trimToNull(motif))
                .build());
        evenementService.record(
                context.sinistre(),
                context.acteur(),
                TypeEvenementSinistre.OPERATION_FINANCIERE,
                "Opération financière annulée : " + operationId
        );
        return responseMapper.toDetail(context.sinistre());
    }

    private Context context(Long agenceId, Long utilisateurId, Long sinistreId) {
        return new Context(
                sinistreService.resolve(agenceId, sinistreId),
                sinistreService.resolveCurrentUser(agenceId, utilisateurId)
        );
    }

    private void assertEditable(Sinistre sinistre) {
        if (!workflowService.isEditable(sinistre.getStatut())) {
            throw new BadRequestException("Le sinistre doit être rouvert avant cette opération");
        }
    }

    private void validateDossierDate(Sinistre sinistre, LocalDate date, String label) {
        validateNotBeforeSinistre(sinistre, date, label);
        if (date.isAfter(LocalDate.now())) {
            throw new BadRequestException("La date de la " + label + " ne peut pas être future");
        }
    }

    private void validateNotBeforeSinistre(Sinistre sinistre, LocalDate date, String label) {
        if (date.isBefore(sinistre.getDateSinistre())) {
            throw new BadRequestException("La date de la " + label + " ne peut pas précéder le sinistre");
        }
    }

    private String trimToNull(String value) {
        return value == null || value.trim().isEmpty() ? null : value.trim();
    }

    private record Context(Sinistre sinistre, Utilisateur acteur) {
    }
}
