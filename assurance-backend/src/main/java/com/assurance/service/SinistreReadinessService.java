package com.assurance.service;

import com.assurance.entity.MissionExpertise;
import com.assurance.entity.ProvisionSinistre;
import com.assurance.entity.Sinistre;
import com.assurance.entity.SinistreDocument;
import com.assurance.entity.SinistreGarantie;
import com.assurance.enums.DecisionCouvertureSinistre;
import com.assurance.enums.StatutDocumentSinistre;
import com.assurance.enums.StatutMissionExpertise;
import com.assurance.enums.StatutSinistre;
import com.assurance.enums.TypeOperationSinistre;
import com.assurance.repository.MissionExpertiseRepository;
import com.assurance.repository.SinistreDocumentRepository;
import com.assurance.repository.SinistreGarantieRepository;
import com.assurance.repository.SinistreOperationRepository;
import com.assurance.repository.ProvisionSinistreRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class SinistreReadinessService {

    private final SinistreWorkflowService workflowService;
    private final SinistreGarantieRepository garantieRepository;
    private final MissionExpertiseRepository missionRepository;
    private final SinistreOperationRepository operationRepository;
    private final SinistreDocumentRepository documentRepository;
    private final ProvisionSinistreRepository provisionRepository;

    public List<TransitionReadiness> transitions(Sinistre sinistre) {
        ReadinessContext context = loadContext(sinistre.getId());
        return workflowService.availableTransitions(sinistre.getStatut()).stream()
                .map(target -> new TransitionReadiness(target, blockers(sinistre, target, context)))
                .toList();
    }

    public List<String> blockers(Sinistre sinistre, StatutSinistre target) {
        return blockers(sinistre, target, loadContext(sinistre.getId()));
    }

    private List<String> blockers(
            Sinistre sinistre,
            StatutSinistre target,
            ReadinessContext context
    ) {
        List<String> blockers = new ArrayList<>();
        List<SinistreGarantie> involved = context.involvedGuarantees();

        if (target == StatutSinistre.DECLARE || target == StatutSinistre.TRANSMIS_COMPAGNIE) {
            if (!hasText(sinistre.getCirconstances())) {
                blockers.add("Renseignez les circonstances du sinistre");
            }
            if (involved.isEmpty()) {
                blockers.add("Sélectionnez au moins une garantie impliquée");
            }
        }

        if (target == StatutSinistre.TRANSMIS_COMPAGNIE) {
            long documentsAwaitingReview = context.documents().stream()
                    .filter(document -> document.getStatut() == StatutDocumentSinistre.RECU)
                    .count();
            if (documentsAwaitingReview > 0) {
                blockers.add("Contrôlez les documents reçus avant transmission");
            }
            long rejectedDocuments = context.documents().stream()
                    .filter(document -> document.getStatut() == StatutDocumentSinistre.REJETE)
                    .count();
            if (rejectedDocuments > 0) {
                blockers.add("Traitez les documents rejetés avant transmission");
            }
        }

        if (target == StatutSinistre.EXPERTISE) {
            boolean hasActiveMission = context.missions().stream()
                    .map(MissionExpertise::getStatut)
                    .anyMatch(status -> status != StatutMissionExpertise.ANNULEE);
            if (!hasActiveMission) {
                blockers.add("Enregistrez une mission d'expertise active");
            }
        }

        if (target == StatutSinistre.EN_ATTENTE_REGLEMENT
                || target == StatutSinistre.PARTIELLEMENT_REGLE
                || target == StatutSinistre.REGLE) {
            if (involved.isEmpty()) {
                blockers.add("Aucune garantie impliquée n'est sélectionnée");
            }
            if (involved.stream().anyMatch(item -> item.getDecisionCouverture()
                    == DecisionCouvertureSinistre.A_ETUDIER)) {
                blockers.add("Finalisez la décision de toutes les garanties impliquées");
            }
            if (totalIndemnisable(involved).signum() <= 0) {
                blockers.add("Renseignez un montant indemnisable accepté");
            }
        }

        BigDecimal indemnity = totalIndemnisable(involved);
        BigDecimal paid = context.totalSettled();
        if (target == StatutSinistre.PARTIELLEMENT_REGLE
                && (paid.signum() <= 0 || paid.compareTo(indemnity) >= 0)) {
            blockers.add("Le total réglé doit être supérieur à zéro et inférieur au montant indemnisable");
        }
        if ((target == StatutSinistre.REGLE || target == StatutSinistre.CLOTURE)
                && sinistre.getStatut() != StatutSinistre.REJETE
                && paid.compareTo(indemnity) < 0) {
            blockers.add("Le montant indemnisable n'est pas entièrement réglé");
        }
        if (target == StatutSinistre.CLOTURE) {
            context.latestProvision()
                    .filter(provision -> provision.getMontant().signum() > 0)
                    .ifPresent(ignored -> blockers.add("Ramenez la provision courante à zéro avant clôture"));
            boolean pendingMission = context.missions().stream()
                    .map(MissionExpertise::getStatut)
                    .anyMatch(status -> status != StatutMissionExpertise.VALIDEE
                            && status != StatutMissionExpertise.ANNULEE);
            if (pendingMission) {
                blockers.add("Finalisez ou annulez les missions d'expertise ouvertes");
            }
            boolean pendingDocument = context.documents().stream()
                    .anyMatch(document -> document.getStatut() == StatutDocumentSinistre.RECU);
            if (pendingDocument) {
                blockers.add("Contrôlez les documents reçus avant clôture");
            }
        }

        return List.copyOf(blockers);
    }

    private ReadinessContext loadContext(Long sinistreId) {
        List<SinistreGarantie> involved = garantieRepository
                .findBySinistreIdOrderBySnapshotCode(sinistreId)
                .stream()
                .filter(SinistreGarantie::isImpliquee)
                .toList();
        return new ReadinessContext(
                involved,
                missionRepository.findBySinistreIdOrderByDateMissionDescCreatedAtDesc(sinistreId),
                documentRepository.findBySinistreIdOrderByCreatedAtDesc(sinistreId),
                provisionRepository.findFirstBySinistreIdOrderByDateProvisionDescCreatedAtDesc(sinistreId),
                totalSettled(sinistreId)
        );
    }

    public BigDecimal totalIndemnisable(Long sinistreId) {
        return totalIndemnisable(garantieRepository.findBySinistreIdOrderBySnapshotCode(sinistreId));
    }

    public BigDecimal totalSettled(Long sinistreId) {
        return operationRepository.totalByType(sinistreId, TypeOperationSinistre.REGLEMENT);
    }

    private BigDecimal totalIndemnisable(List<SinistreGarantie> guarantees) {
        return guarantees.stream()
                .filter(SinistreGarantie::isImpliquee)
                .filter(item -> item.getDecisionCouverture() == DecisionCouvertureSinistre.ACCEPTEE
                        || item.getDecisionCouverture() == DecisionCouvertureSinistre.PARTIELLE)
                .map(SinistreGarantie::getMontantIndemnisable)
                .filter(value -> value != null && value.signum() > 0)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    public record TransitionReadiness(StatutSinistre statut, List<String> blockers) {
        public boolean allowed() {
            return blockers.isEmpty();
        }
    }

    private record ReadinessContext(
            List<SinistreGarantie> involvedGuarantees,
            List<MissionExpertise> missions,
            List<SinistreDocument> documents,
            Optional<ProvisionSinistre> latestProvision,
            BigDecimal totalSettled
    ) {
    }
}
