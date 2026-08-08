package com.assurance.service;

import com.assurance.dto.request.AddProvisionSinistreRequest;
import com.assurance.dto.request.AddSinistreOperationRequest;
import com.assurance.dto.request.AddSinistrePartieRequest;
import com.assurance.dto.request.UpdateSinistreGarantieRequest;
import com.assurance.dto.request.UpsertMissionExpertiseRequest;
import com.assurance.dto.response.SinistreDetailResponse;
import com.assurance.entity.Client;
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
import com.assurance.enums.ModeReglementSinistre;
import com.assurance.enums.StatutSinistre;
import com.assurance.enums.TypeContrepartieSinistre;
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
import java.math.BigDecimal;
import java.util.EnumSet;
import java.util.Set;

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
    private final SinistreReadinessService readinessService;
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
        validateGuaranteeDecision(request);
        garantie.setImpliquee(Boolean.TRUE.equals(request.getImpliquee()));
        garantie.setDecisionCouverture(request.getDecisionCouverture());
        garantie.setFranchiseAppliquee(request.getFranchiseAppliquee());
        garantie.setMontantIndemnisable(request.getMontantIndemnisable());
        if (request.getDecisionCouverture() == DecisionCouvertureSinistre.REFUSEE) {
            garantie.setMontantIndemnisable(null);
        }
        garantieRepository.save(garantie);
        BigDecimal paid = readinessService.totalSettled(sinistreId);
        BigDecimal indemnity = readinessService.totalIndemnisable(sinistreId);
        if (paid.compareTo(indemnity) > 0) {
            throw new BadRequestException(
                    "Le montant indemnisable ne peut pas être inférieur aux indemnisations déjà enregistrées"
            );
        }
        evenementService.record(
                context.sinistre(),
                context.acteur(),
                TypeEvenementSinistre.MODIFICATION,
                "Décision de couverture mise à jour pour la garantie " + garantie.getSnapshotCode()
        );
        synchronizeSettlementStatus(context);
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
        if (operationRepository.existsByContrepartiePartieId(partieId)) {
            throw new BadRequestException(
                    "Cette partie est utilisée par une opération financière et ne peut pas être supprimée"
            );
        }
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
        if (context.sinistre().getStatut() == StatutSinistre.BROUILLON) {
            throw new BadRequestException("Déclarez le sinistre avant d'enregistrer une provision");
        }
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
        if (context.sinistre().getStatut() == StatutSinistre.BROUILLON) {
            throw new BadRequestException("Déclarez le sinistre avant d'enregistrer une opération financière");
        }
        validateDossierDate(context.sinistre(), request.getDateOperation(), "opération financière");
        if (request.getType() == TypeOperationSinistre.ANNULATION) {
            throw new BadRequestException("Utilisez l'action d'annulation d'une opération existante");
        }
        if (request.getType() == TypeOperationSinistre.REGLEMENT
                && !SETTLEMENT_STATUSES.contains(context.sinistre().getStatut())) {
            throw new BadRequestException(
                    "Passez le sinistre en attente de règlement avant d'enregistrer une indemnisation"
            );
        }
        if (request.getType() == TypeOperationSinistre.REGLEMENT) {
            BigDecimal indemnity = readinessService.totalIndemnisable(sinistreId);
            BigDecimal afterPayment = readinessService.totalSettled(sinistreId).add(request.getMontant());
            if (indemnity.signum() <= 0) {
                throw new BadRequestException("Aucun montant indemnisable accepté n'est enregistré");
            }
            if (afterPayment.compareTo(indemnity) > 0) {
                throw new BadRequestException(
                        "Le règlement dépasse le solde indemnisable restant"
                );
            }
        }
        validatePaymentReference(request);
        ResolvedCounterparty counterparty = resolveCounterparty(context, request);
        operationRepository.save(SinistreOperation.builder()
                .sinistre(context.sinistre())
                .saisiPar(context.acteur())
                .type(request.getType())
                .dateOperation(request.getDateOperation())
                .montant(request.getMontant())
                .reference(trimToNull(request.getReference()))
                .compagnieAssurance(context.sinistre().getCompagnieAssurance())
                .typeContrepartie(request.getTypeContrepartie())
                .contrepartieClient(counterparty.client())
                .contrepartiePartie(counterparty.partie())
                .contrepartieExpert(counterparty.expert())
                .contrepartieGarage(counterparty.garage())
                .contrepartieNomSnapshot(counterparty.name())
                .contrepartieNomLibre(counterparty.freeName())
                .justificationContrepartieLibre(counterparty.freeJustification())
                .modeReglement(request.getModeReglement())
                .notes(trimToNull(request.getNotes()))
                .build());
        evenementService.record(
                context.sinistre(),
                context.acteur(),
                TypeEvenementSinistre.OPERATION_FINANCIERE,
                "Opération " + request.getType() + " enregistrée pour "
                        + request.getMontant() + " avec " + counterparty.name()
        );
        if (request.getType() == TypeOperationSinistre.REGLEMENT) {
            synchronizeSettlementStatus(context);
        }
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
                .compagnieAssurance(operation.getCompagnieAssurance())
                .typeContrepartie(operation.getTypeContrepartie())
                .contrepartieClient(operation.getContrepartieClient())
                .contrepartiePartie(operation.getContrepartiePartie())
                .contrepartieExpert(operation.getContrepartieExpert())
                .contrepartieGarage(operation.getContrepartieGarage())
                .contrepartieNomSnapshot(operation.getContrepartieNomSnapshot())
                .contrepartieNomLibre(operation.getContrepartieNomLibre())
                .justificationContrepartieLibre(operation.getJustificationContrepartieLibre())
                .modeReglement(operation.getModeReglement())
                .notes(trimToNull(motif))
                .build());
        evenementService.record(
                context.sinistre(),
                context.acteur(),
                TypeEvenementSinistre.OPERATION_FINANCIERE,
                "Opération financière annulée : " + operationId
        );
        if (operation.getType() == TypeOperationSinistre.REGLEMENT) {
            synchronizeSettlementStatus(context);
        }
        return responseMapper.toDetail(context.sinistre());
    }

    private static final Set<StatutSinistre> SETTLEMENT_STATUSES = EnumSet.of(
            StatutSinistre.EN_ATTENTE_REGLEMENT,
            StatutSinistre.PARTIELLEMENT_REGLE,
            StatutSinistre.REGLE
    );

    private void validatePaymentReference(AddSinistreOperationRequest request) {
        if (request.getModeReglement() != ModeReglementSinistre.ESPECES
                && !hasText(request.getReference())) {
            throw new BadRequestException(
                    "La référence est obligatoire pour un règlement autre qu'en espèces"
            );
        }
    }

    private ResolvedCounterparty resolveCounterparty(
            Context context,
            AddSinistreOperationRequest request
    ) {
        Long id = request.getContrepartieId();
        String freeName = trimToNull(request.getContrepartieNomLibre());
        String freeJustification = trimToNull(request.getJustificationContrepartieLibre());
        if (request.getTypeContrepartie() != TypeContrepartieSinistre.AUTRE
                && (freeName != null || freeJustification != null)) {
            throw new BadRequestException(
                    "Le nom libre et sa justification sont réservés aux contreparties de type AUTRE"
            );
        }
        return switch (request.getTypeContrepartie()) {
            case CLIENT -> {
                Client client = context.sinistre().getClient();
                if (id != null && !id.equals(client.getId())) {
                    throw new BadRequestException("Le client sélectionné n'est pas celui du sinistre");
                }
                yield new ResolvedCounterparty(client, null, null, null,
                        client.getNomAffichage(), null, null);
            }
            case PARTIE -> {
                requireCounterpartyId(id);
                SinistrePartie partie = partieRepository.findByIdAndSinistreId(id, context.sinistre().getId())
                        .orElseThrow(() -> new ResourceNotFoundException("SinistrePartie", id));
                yield new ResolvedCounterparty(null, partie, null, null,
                        partie.getNom(), null, null);
            }
            case EXPERT -> {
                requireCounterpartyId(id);
                ExpertSinistre expert = expertRepository.findByIdAndAgenceId(id, context.sinistre().getAgence().getId())
                        .orElseThrow(() -> new ResourceNotFoundException("ExpertSinistre", id));
                if (!missionRepository.existsBySinistreIdAndExpertId(context.sinistre().getId(), id)) {
                    throw new BadRequestException("L'expert sélectionné n'est lié à aucune mission de ce sinistre");
                }
                yield new ResolvedCounterparty(null, null, expert, null,
                        expert.getNom(), null, null);
            }
            case GARAGE -> {
                requireCounterpartyId(id);
                GarageSinistre garage = garageRepository.findByIdAndAgenceId(id, context.sinistre().getAgence().getId())
                        .orElseThrow(() -> new ResourceNotFoundException("GarageSinistre", id));
                if (!missionRepository.existsBySinistreIdAndGarageId(context.sinistre().getId(), id)) {
                    throw new BadRequestException("Le garage sélectionné n'est lié à aucune mission de ce sinistre");
                }
                yield new ResolvedCounterparty(null, null, null, garage,
                        garage.getRaisonSociale(), null, null);
            }
            case AUTRE -> {
                if (id != null) {
                    throw new BadRequestException("Une contrepartie libre ne doit pas contenir d'identifiant");
                }
                if (freeName == null || freeJustification == null) {
                    throw new BadRequestException(
                            "Le nom et la justification sont obligatoires pour une contrepartie libre"
                    );
                }
                yield new ResolvedCounterparty(null, null, null, null,
                        freeName, freeName, freeJustification);
            }
        };
    }

    private void requireCounterpartyId(Long id) {
        if (id == null) {
            throw new BadRequestException("Sélectionnez une contrepartie enregistrée");
        }
    }

    private void validateGuaranteeDecision(UpdateSinistreGarantieRequest request) {
        boolean accepted = request.getDecisionCouverture() == DecisionCouvertureSinistre.ACCEPTEE
                || request.getDecisionCouverture() == DecisionCouvertureSinistre.PARTIELLE;
        if (Boolean.TRUE.equals(request.getImpliquee())
                && accepted
                && (request.getMontantIndemnisable() == null
                || request.getMontantIndemnisable().signum() <= 0)) {
            throw new BadRequestException(
                    "Un montant indemnisable positif est obligatoire pour une garantie acceptée"
            );
        }
    }

    private void synchronizeSettlementStatus(Context context) {
        Sinistre sinistre = context.sinistre();
        if (!SETTLEMENT_STATUSES.contains(sinistre.getStatut())) {
            return;
        }
        BigDecimal indemnity = readinessService.totalIndemnisable(sinistre.getId());
        BigDecimal paid = readinessService.totalSettled(sinistre.getId());
        StatutSinistre target;
        if (paid.signum() <= 0) {
            target = StatutSinistre.EN_ATTENTE_REGLEMENT;
        } else if (indemnity.signum() > 0 && paid.compareTo(indemnity) >= 0) {
            target = StatutSinistre.REGLE;
        } else {
            target = StatutSinistre.PARTIELLEMENT_REGLE;
        }
        if (target == sinistre.getStatut()) {
            return;
        }
        StatutSinistre previous = sinistre.getStatut();
        workflowService.transition(sinistre, target);
        sinistreRepository.save(sinistre);
        evenementService.record(
                sinistre,
                context.acteur(),
                TypeEvenementSinistre.CHANGEMENT_STATUT,
                "Statut financier recalculé selon les indemnisations enregistrées",
                previous,
                target
        );
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

    private boolean hasText(String value) {
        return trimToNull(value) != null;
    }

    private record Context(Sinistre sinistre, Utilisateur acteur) {
    }

    private record ResolvedCounterparty(
            Client client,
            SinistrePartie partie,
            ExpertSinistre expert,
            GarageSinistre garage,
            String name,
            String freeName,
            String freeJustification
    ) {
    }
}
