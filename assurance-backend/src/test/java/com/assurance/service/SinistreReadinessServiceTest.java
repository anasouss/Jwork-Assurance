package com.assurance.service;

import com.assurance.entity.ProvisionSinistre;
import com.assurance.entity.Agence;
import com.assurance.entity.ExigenceDocumentSinistre;
import com.assurance.entity.Sinistre;
import com.assurance.entity.SinistreGarantie;
import com.assurance.enums.DecisionCouvertureSinistre;
import com.assurance.enums.NatureSinistre;
import com.assurance.enums.TypeDocumentSinistre;
import com.assurance.enums.StatutSinistre;
import com.assurance.enums.TypeOperationSinistre;
import com.assurance.repository.MissionExpertiseRepository;
import com.assurance.repository.ProvisionSinistreRepository;
import com.assurance.repository.SinistreDocumentRepository;
import com.assurance.repository.SinistreGarantieRepository;
import com.assurance.repository.SinistreOperationRepository;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class SinistreReadinessServiceTest {

    private final SinistreGarantieRepository guarantees = mock(SinistreGarantieRepository.class);
    private final MissionExpertiseRepository missions = mock(MissionExpertiseRepository.class);
    private final SinistreOperationRepository operations = mock(SinistreOperationRepository.class);
    private final SinistreDocumentRepository documents = mock(SinistreDocumentRepository.class);
    private final ProvisionSinistreRepository provisions = mock(ProvisionSinistreRepository.class);
    private final SinistreDocumentRequirementService documentRequirements =
            mock(SinistreDocumentRequirementService.class);
    private final SinistreReadinessService service = new SinistreReadinessService(
            new SinistreWorkflowService(),
            guarantees,
            missions,
            operations,
            documents,
            provisions,
            documentRequirements
    );

    @Test
    void settlementReadinessUsesAcceptedIndemnityAndActivePayments() {
        Sinistre claim = claim(10L, StatutSinistre.EN_ATTENTE_REGLEMENT);
        when(guarantees.findForDetailOrderByConfiguredDisplay(10L))
                .thenReturn(List.of(acceptedGuarantee("1000.00")));
        when(operations.totalByType(10L, TypeOperationSinistre.REGLEMENT))
                .thenReturn(new BigDecimal("400.00"));

        assertThat(service.blockers(claim, StatutSinistre.PARTIELLEMENT_REGLE)).isEmpty();
        assertThat(service.blockers(claim, StatutSinistre.REGLE))
                .containsExactly("Le montant indemnisable n'est pas entièrement réglé");

        when(operations.totalByType(10L, TypeOperationSinistre.REGLEMENT))
                .thenReturn(new BigDecimal("1000.00"));
        assertThat(service.blockers(claim, StatutSinistre.REGLE)).isEmpty();
    }

    @Test
    void closureRequiresReleasedProvision() {
        Sinistre claim = claim(11L, StatutSinistre.REGLE);
        when(guarantees.findForDetailOrderByConfiguredDisplay(11L))
                .thenReturn(List.of(acceptedGuarantee("1000.00")));
        when(operations.totalByType(11L, TypeOperationSinistre.REGLEMENT))
                .thenReturn(new BigDecimal("1000.00"));
        when(missions.findBySinistreIdOrderByDateMissionDescCreatedAtDesc(11L))
                .thenReturn(List.of());
        when(documents.findBySinistreIdOrderByCreatedAtDesc(11L))
                .thenReturn(List.of());
        when(provisions.findFirstBySinistreIdOrderByDateProvisionDescCreatedAtDesc(11L))
                .thenReturn(Optional.of(ProvisionSinistre.builder()
                        .montant(new BigDecimal("250.00"))
                        .build()));

        assertThat(service.blockers(claim, StatutSinistre.CLOTURE))
                .contains("Ramenez la provision courante à zéro avant clôture");
    }

    @Test
    void partialSettlementCannotBeClosedDirectly() {
        assertThat(new SinistreWorkflowService().availableTransitions(StatutSinistre.PARTIELLEMENT_REGLE))
                .doesNotContain(StatutSinistre.CLOTURE);
    }

    @Test
    void rejectedClaimIsReadOnlyUntilReopened() {
        assertThat(new SinistreWorkflowService().isEditable(StatutSinistre.REJETE)).isFalse();
        assertThat(new SinistreWorkflowService().availableTransitions(StatutSinistre.REJETE))
                .containsExactlyInAnyOrder(StatutSinistre.CLOTURE, StatutSinistre.ROUVERT);
    }

    @Test
    void transmissionIsBlockedWhenARequiredDocumentIsMissing() {
        Sinistre claim = claim(12L, StatutSinistre.DECLARE);
        when(guarantees.findForDetailOrderByConfiguredDisplay(12L))
                .thenReturn(List.of(acceptedGuarantee("1000.00")));
        when(documents.findBySinistreIdOrderByCreatedAtDesc(12L)).thenReturn(List.of());
        when(documentRequirements.applicable(1L, NatureSinistre.ACCIDENT)).thenReturn(List.of(
                ExigenceDocumentSinistre.builder()
                        .typeDocument(TypeDocumentSinistre.DECLARATION)
                        .libelle("Déclaration de sinistre")
                        .obligatoire(true)
                        .build()
        ));

        assertThat(service.blockers(claim, StatutSinistre.TRANSMIS_COMPAGNIE))
                .contains("Ajoutez le document obligatoire : Déclaration de sinistre");
    }

    private Sinistre claim(Long id, StatutSinistre status) {
        Agence agency = new Agence();
        agency.setId(1L);
        Sinistre claim = Sinistre.builder()
                .agence(agency)
                .statut(status)
                .nature(NatureSinistre.ACCIDENT)
                .circonstances("Collision")
                .build();
        claim.setId(id);
        return claim;
    }

    private SinistreGarantie acceptedGuarantee(String amount) {
        return SinistreGarantie.builder()
                .impliquee(true)
                .decisionCouverture(DecisionCouvertureSinistre.ACCEPTEE)
                .montantIndemnisable(new BigDecimal(amount))
                .build();
    }
}
