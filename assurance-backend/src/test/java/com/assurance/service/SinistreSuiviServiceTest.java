package com.assurance.service;

import com.assurance.dto.request.TransitionEtapeSinistreRequest;
import com.assurance.entity.Agence;
import com.assurance.entity.MissionExpertise;
import com.assurance.entity.Sinistre;
import com.assurance.entity.Utilisateur;
import com.assurance.enums.EtapeSuiviSinistre;
import com.assurance.enums.PhaseExpertiseSinistre;
import com.assurance.enums.StatutMissionExpertise;
import com.assurance.enums.StatutSinistre;
import com.assurance.enums.TypeEvenementSinistre;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.MissionExpertiseRepository;
import com.assurance.repository.SinistreEvenementRepository;
import com.assurance.repository.SinistreRepository;
import com.assurance.repository.UtilisateurRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class SinistreSuiviServiceTest {
    private final SinistreRepository claims = mock(SinistreRepository.class);
    private final UtilisateurRepository users = mock(UtilisateurRepository.class);
    private final MissionExpertiseRepository missions = mock(MissionExpertiseRepository.class);
    private final SinistreEvenementRepository events = mock(SinistreEvenementRepository.class);
    private final SinistreReadinessService readiness = mock(SinistreReadinessService.class);
    private final SinistreSuiviService service = new SinistreSuiviService(
            claims, users, missions, events, readiness, new SinistreWorkflowService());
    private Sinistre claim;

    @BeforeEach
    void setUp() {
        Agence agency = new Agence();
        agency.setId(1L);
        Utilisateur user = new Utilisateur();
        user.setAgence(agency);
        user.setId(7L);
        claim = Sinistre.builder().agence(agency).statut(StatutSinistre.DECLARE).build();
        claim.setId(10L);
        when(claims.findByIdAndAgenceIdForUpdate(10L, 1L)).thenReturn(Optional.of(claim));
        when(users.findById(7L)).thenReturn(Optional.of(user));
    }

    @Test
    void waitingClientRequiresReasonAndRecordsTypedAuditWithoutChangingFinancialStatus() {
        assertThatThrownBy(() -> service.transition(1L, 7L, 10L, request(EtapeSuiviSinistre.INSTANCE_CLIENT, null)))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("motif");

        service.transition(1L, 7L, 10L, request(EtapeSuiviSinistre.INSTANCE_CLIENT, "Attente PV client"));

        assertThat(claim.getStatut()).isEqualTo(StatutSinistre.DECLARE);
        assertThat(claim.getEtapeSuivi()).isEqualTo(EtapeSuiviSinistre.INSTANCE_CLIENT);
        verify(events).save(argThat(event -> event.getType() == TypeEvenementSinistre.CHANGEMENT_ETAPE
                && event.getAncienneEtape() == EtapeSuiviSinistre.OUVERTURE
                && event.getNouvelleEtape() == EtapeSuiviSinistre.INSTANCE_CLIENT
                && event.getDescription().contains("Attente PV client")));
    }

    @Test
    void expertiseAfterRepairsRequiresAnActiveAfterMissionNotBeforeMission() {
        claim.setEtapeSuivi(EtapeSuiviSinistre.INSTANCE_CLIENT);
        MissionExpertise mission = MissionExpertise.builder().phase(PhaseExpertiseSinistre.AVANT)
                .statut(StatutMissionExpertise.MANDATEE).build();
        when(missions.findBySinistreIdOrderByDateMissionDescCreatedAtDesc(10L)).thenReturn(List.of(mission));
        assertThat(service.blockers(claim, EtapeSuiviSinistre.EXPERTISE_APRES)).isNotEmpty();
        mission.setPhase(PhaseExpertiseSinistre.APRES);
        assertThat(service.blockers(claim, EtapeSuiviSinistre.EXPERTISE_APRES)).isEmpty();
        mission.setStatut(StatutMissionExpertise.ANNULEE);
        assertThat(service.blockers(claim, EtapeSuiviSinistre.EXPERTISE_APRES)).isNotEmpty();
    }

    @Test
    void closureUsesFinancialGuardsAndDoesNotMutateOnFailure() {
        claim.setEtapeSuivi(EtapeSuiviSinistre.COMPAGNIE);
        claim.setStatut(StatutSinistre.REGLE);
        when(readiness.blockers(claim, StatutSinistre.CLOTURE)).thenReturn(List.of("Provision non nulle"));
        assertThatThrownBy(() -> service.transition(1L, 7L, 10L, request(EtapeSuiviSinistre.CLOTURE, null)))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("Provision");
        assertThat(claim.getEtapeSuivi()).isEqualTo(EtapeSuiviSinistre.COMPAGNIE);
        verifyNoInteractions(events);
    }

    @Test
    void closureSynchronizesFinancialStatusAndDate() {
        claim.setEtapeSuivi(EtapeSuiviSinistre.COMPAGNIE);
        claim.setStatut(StatutSinistre.REGLE);
        service.transition(1L, 7L, 10L, request(EtapeSuiviSinistre.CLOTURE, null));
        assertThat(claim.getStatut()).isEqualTo(StatutSinistre.CLOTURE);
        assertThat(claim.getDateCloture()).isEqualTo(LocalDate.now());
        assertThat(new SinistreWorkflowService().isEditable(claim)).isFalse();
    }

    @Test
    void companySynchronizesEarlyFinancialStatusButPreservesAdvancedStatusAndOriginalDate() {
        service.transition(1L, 7L, 10L, request(EtapeSuiviSinistre.COMPAGNIE, "Pas d'expertise necessaire"));
        assertThat(claim.getStatut()).isEqualTo(StatutSinistre.TRANSMIS_COMPAGNIE);
        assertThat(claim.getDateTransmission()).isEqualTo(LocalDate.now());
        claim.setEtapeSuivi(EtapeSuiviSinistre.INSTANCE_CLIENT);
        claim.setStatut(StatutSinistre.PARTIELLEMENT_REGLE);
        LocalDate original = LocalDate.now().minusDays(3);
        claim.setDateTransmission(original);
        service.transition(1L, 7L, 10L, request(EtapeSuiviSinistre.COMPAGNIE, "Pieces complementaires transmises"));
        assertThat(claim.getStatut()).isEqualTo(StatutSinistre.PARTIELLEMENT_REGLE);
        assertThat(claim.getDateTransmission()).isEqualTo(original);
    }

    @Test
    void closedClaimRequiresFinancialReopeningBeforeReturningToClientWait() {
        claim.setEtapeSuivi(EtapeSuiviSinistre.CLOTURE);
        claim.setStatut(StatutSinistre.CLOTURE);
        assertThat(service.blockers(claim, EtapeSuiviSinistre.INSTANCE_CLIENT)).isNotEmpty();
        claim.setStatut(StatutSinistre.ROUVERT);
        service.transition(1L, 7L, 10L, request(EtapeSuiviSinistre.INSTANCE_CLIENT, "Nouvelle piece client"));
        assertThat(claim.getStatut()).isEqualTo(StatutSinistre.ROUVERT);
    }

    @Test
    void draftCannotProgressOperationally() {
        claim.setStatut(StatutSinistre.BROUILLON);
        assertThat(service.blockers(claim, EtapeSuiviSinistre.INSTANCE_CLIENT)).isNotEmpty();
    }

    @Test
    void expertiseCanSkipClientWaitWithReasonAndDestinationGuards() {
        claim.setEtapeSuivi(EtapeSuiviSinistre.EXPERTISE_AVANT);
        assertThat(service.destinations(claim.getEtapeSuivi()))
                .contains(EtapeSuiviSinistre.COMPAGNIE, EtapeSuiviSinistre.EXPERTISE_APRES);
        assertThat(service.requiresReason(claim.getEtapeSuivi(), EtapeSuiviSinistre.COMPAGNIE)).isTrue();
        assertThat(service.requiresReason(claim.getEtapeSuivi(), EtapeSuiviSinistre.EXPERTISE_APRES)).isTrue();
        assertThat(service.blockers(claim, EtapeSuiviSinistre.EXPERTISE_APRES)).isNotEmpty();
        service.transition(1L, 7L, 10L, request(EtapeSuiviSinistre.COMPAGNIE, "Perte totale, sans reparation"));
        assertThat(claim.getStatut()).isEqualTo(StatutSinistre.TRANSMIS_COMPAGNIE);
        assertThat(claim.getEtapeSuivi()).isEqualTo(EtapeSuiviSinistre.COMPAGNIE);
    }

    @Test
    void foreignTenantClaimCannotBeResolvedAndNothingIsWritten() {
        assertThatThrownBy(() -> service.transition(2L, 7L, 10L, request(EtapeSuiviSinistre.INSTANCE_CLIENT, "Attente")))
                .isInstanceOf(ResourceNotFoundException.class);
        verifyNoInteractions(events);
    }

    @Test
    void staleVersionCannotTransition() {
        TransitionEtapeSinistreRequest request = request(EtapeSuiviSinistre.INSTANCE_CLIENT, "Attente");
        request.setVersion(12L);
        assertThatThrownBy(() -> service.transition(1L, 7L, 10L, request))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("rechargez");
        verifyNoInteractions(events);
    }

    private TransitionEtapeSinistreRequest request(EtapeSuiviSinistre target, String reason) {
        TransitionEtapeSinistreRequest request = new TransitionEtapeSinistreRequest();
        request.setEtapeSuivi(target);
        request.setMotif(reason);
        request.setVersion(claim.getVersion());
        return request;
    }
}
