package com.assurance.service;

import com.assurance.entity.Contrat;
import com.assurance.entity.MouvementContrat;
import com.assurance.enums.MotifBlocageModificationContrat;
import com.assurance.enums.StatutContrat;
import com.assurance.enums.StatutMouvementContrat;
import com.assurance.exception.ConflictException;
import com.assurance.repository.AffectationReglementClientRepository;
import com.assurance.repository.LigneDocumentClientRepository;
import com.assurance.repository.MouvementContratRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class ContractDirectModificationPolicy {

    private static final Set<String> INITIAL_MOVEMENT_CODES = Set.of("AN", "REN");

    private final MouvementContratRepository mouvementContratRepository;
    private final AffectationReglementClientRepository affectationReglementClientRepository;
    private final LigneDocumentClientRepository ligneDocumentClientRepository;

    @Transactional(readOnly = true)
    public Evaluation evaluate(Long agenceId, Contrat contract) {
        return evaluateAll(
                agenceId,
                List.of(contract),
                mouvementContratRepository.findByContratIdOrderByCreatedAtDesc(contract.getId())
        ).get(0);
    }

    @Transactional(readOnly = true)
    public List<Evaluation> evaluateAll(
            Long agenceId,
            List<Contrat> contracts,
            List<MouvementContrat> movements
    ) {
        if (contracts.isEmpty()) {
            return List.of();
        }
        List<Long> contractIds = contracts.stream().map(Contrat::getId).toList();
        Set<Long> contractsWithPayments = new HashSet<>(
                affectationReglementClientRepository.findContractIdsWithActiveDirectPayments(agenceId, contractIds)
        );
        contractsWithPayments.addAll(
                affectationReglementClientRepository.findContractIdsWithActiveDocumentPayments(agenceId, contractIds)
        );
        Set<Long> contractsWithDocuments = new HashSet<>(
                ligneDocumentClientRepository.findContractIdsWithIssuedDocuments(agenceId, contractIds)
        );

        return contracts.stream()
                .map(contract -> evaluateState(
                        contract,
                        movementsFor(contract.getId(), movements),
                        contractsWithPayments.contains(contract.getId()),
                        contractsWithDocuments.contains(contract.getId())
                ))
                .toList();
    }

    public void assertAllowed(Long agenceId, Contrat contract) {
        Evaluation evaluation = evaluate(agenceId, contract);
        if (!evaluation.allowed()) {
            throw new ConflictException("CONTRACT_DIRECT_MODIFICATION_BLOCKED", message(evaluation.reason()));
        }
    }

    static Evaluation evaluateState(
            Contrat contract,
            List<MouvementContrat> movements,
            boolean hasPayment,
            boolean hasIssuedDocument
    ) {
        boolean editableDraft = contract.getStatut() == StatutContrat.DRAFT
                && (Boolean.TRUE.equals(contract.getBrouillon()) || Boolean.TRUE.equals(contract.getProspection()));
        if (editableDraft) {
            return Evaluation.permitted();
        }
        if (contract.getStatut() == StatutContrat.RENEWED || Boolean.TRUE.equals(contract.getRenouvele())) {
            return Evaluation.blocked(MotifBlocageModificationContrat.CONTRAT_RENOUVELE);
        }
        if (contract.getStatut() != StatutContrat.ACTIVE
                || Boolean.TRUE.equals(contract.getBrouillon())
                || Boolean.TRUE.equals(contract.getProspection())) {
            return Evaluation.blocked(MotifBlocageModificationContrat.CONTRAT_CLOS);
        }
        boolean hasLaterMovement = movements.stream()
                .filter(movement -> movement.getStatut() == StatutMouvementContrat.VALIDE)
                .map(ContractDirectModificationPolicy::movementCode)
                .anyMatch(code -> !INITIAL_MOVEMENT_CODES.contains(code));
        if (hasLaterMovement) {
            return Evaluation.blocked(MotifBlocageModificationContrat.MOUVEMENT_ULTERIEUR);
        }
        if (hasPayment) {
            return Evaluation.blocked(MotifBlocageModificationContrat.REGLEMENT_EXISTANT);
        }
        if (hasIssuedDocument) {
            return Evaluation.blocked(MotifBlocageModificationContrat.DOCUMENT_CLIENT_EMIS);
        }
        return Evaluation.permitted();
    }

    private List<MouvementContrat> movementsFor(Long contractId, Collection<MouvementContrat> movements) {
        return movements.stream()
                .filter(movement -> movement.getContrat() != null && contractId.equals(movement.getContrat().getId()))
                .toList();
    }

    private static String movementCode(MouvementContrat movement) {
        return movement.getTypeMouvement() == null || movement.getTypeMouvement().getCode() == null
                ? ""
                : movement.getTypeMouvement().getCode().trim().toUpperCase(Locale.ROOT);
    }

    private String message(MotifBlocageModificationContrat reason) {
        return switch (reason) {
            case REGLEMENT_EXISTANT -> "Ce contrat possède déjà un règlement actif. Utilisez un avenant pour préserver l'historique comptable.";
            case DOCUMENT_CLIENT_EMIS -> "Ce contrat figure déjà sur un document client émis. Utilisez un avenant pour préserver le document comptable.";
            case MOUVEMENT_ULTERIEUR -> "Ce contrat contient déjà un avenant ou un mouvement ultérieur. Rectifiez le dernier mouvement ou créez un nouvel avenant.";
            case CONTRAT_RENOUVELE -> "Ce contrat a déjà été renouvelé et ne peut plus être modifié directement.";
            case CONTRAT_CLOS -> "Le statut de ce contrat ne permet plus sa modification directe.";
        };
    }

    public record Evaluation(boolean allowed, MotifBlocageModificationContrat reason) {
        public static Evaluation permitted() {
            return new Evaluation(true, null);
        }

        public static Evaluation blocked(MotifBlocageModificationContrat reason) {
            return new Evaluation(false, reason);
        }
    }
}
