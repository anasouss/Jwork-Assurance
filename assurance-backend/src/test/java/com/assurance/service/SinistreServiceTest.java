package com.assurance.service;

import com.assurance.activity.BusinessActivityRecorder;
import com.assurance.dto.request.CreateSinistreRequest;
import com.assurance.entity.Agence;
import com.assurance.entity.BrancheAssurance;
import com.assurance.entity.Client;
import com.assurance.entity.CompagnieAssurance;
import com.assurance.entity.Contrat;
import com.assurance.entity.Garantie;
import com.assurance.entity.MouvementContrat;
import com.assurance.entity.MouvementGarantie;
import com.assurance.entity.Sinistre;
import com.assurance.entity.Utilisateur;
import com.assurance.enums.EtapeSuiviSinistre;
import com.assurance.enums.StatutSinistre;
import com.assurance.dto.request.TransitionSinistreRequest;
import com.assurance.dto.response.SinistreDetailResponse;
import com.assurance.exception.BadRequestException;
import com.assurance.repository.GarageSinistreRepository;
import com.assurance.repository.SinistreCouvertureRepository;
import com.assurance.repository.SinistreGarantieRepository;
import com.assurance.repository.SinistreRepository;
import com.assurance.repository.UtilisateurRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.function.Supplier;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SinistreServiceTest {
    @Mock
    private SinistreRepository claims;
    @Mock
    private SinistreCouvertureRepository snapshots;
    @Mock
    private SinistreGarantieRepository guarantees;
    @Mock
    private UtilisateurRepository users;
    @Mock
    private SinistreCouvertureService coverage;
    @Mock
    private SinistreNumeroService numbers;
    @Mock
    private SinistreEvenementService events;
    @Mock
    private BusinessActivityRecorder activity;
    @Mock
    private SinistreReadinessService readiness;
    @Mock
    private SinistreResponseMapper mapper;
    @Spy
    private SinistreWorkflowService workflow = new SinistreWorkflowService();
    @Spy
    private SinistreQualificationService qualification = new SinistreQualificationService(mock(GarageSinistreRepository.class));
    @InjectMocks
    private SinistreService service;
    private CreateSinistreRequest request;
    private Garantie guarantee;

    @BeforeEach
    void setUp() {
        Agence agency = new Agence();
        agency.setId(1L);
        Utilisateur user = new Utilisateur();
        user.setAgence(agency);
        when(users.findById(7L)).thenReturn(Optional.of(user));
        BrancheAssurance branch = BrancheAssurance.builder().code("AUTOMOBILE").build();
        Contrat contract = Contrat.builder().agence(agency).brancheAssurance(branch)
                .compagnieAssurance(CompagnieAssurance.builder().code("C").nom("Compagnie").build()).build();
        Client insured = Client.builder().nom("Historique").build();
        guarantee = Garantie.builder().code("DOM").libelle("Dommages").build();
        guarantee.setId(9L);
        MouvementGarantie source = MouvementGarantie.builder().garantie(guarantee).build();
        when(coverage.resolve(eq(1L), eq(2L), eq(null), any())).thenReturn(
                new SinistreCouvertureService.CouvertureResolue(contract, new MouvementContrat(), insured,
                        null, null, List.of(source), List.of()));
        when(claims.save(any())).thenAnswer(call -> {
            Sinistre claim = call.getArgument(0);
            claim.setId(10L);
            return claim;
        });
        when(snapshots.save(any())).thenAnswer(call -> call.getArgument(0));
        when(numbers.next(eq(1L), anyInt())).thenReturn("SIN/A/2026/00001");
        doAnswer(call -> call.getArgument(0, Supplier.class).get()).when(activity).perform(any(), any());
        request = new CreateSinistreRequest();
        request.setContratId(2L);
        request.setDateSinistre(LocalDate.now().minusDays(1));
        request.setDateDeclaration(LocalDate.now());
        request.setGarantieIds(List.of(9L));
        request.setDeclarer(true);
    }

    @Test
    void declaredAutomobileCannotBeCreatedWithoutQualification() {
        assertThatThrownBy(() -> service.create(1L, 7L, request))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("type de dommage");
        verifyNoInteractions(events);
    }

    @Test
    void declaredRcCannotBeCreatedWithoutResponsibility() {
        guarantee.setResponsabiliteCivile(true);
        assertThatThrownBy(() -> service.create(1L, 7L, request))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("responsabilite RC");
        verifyNoInteractions(claims, events);
    }

    @Test
    void registerRejectsInvertedDateRangeBeforeQuerying() {
        assertThatThrownBy(() -> service.registre(1L, null, null, null, null, null, null,
                LocalDate.now(), LocalDate.now().minusDays(1)))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("date de debut");
        verifyNoInteractions(claims);
    }

    @Test
    void administrativeClosureAlsoClosesOperationalTrackingAndRecordsItsHistory() {
        var claim = lifecycleClaim(StatutSinistre.REGLE, EtapeSuiviSinistre.EXPERTISE_APRES);
        var request = new TransitionSinistreRequest();
        request.setStatut(StatutSinistre.CLOTURE);

        service.transition(1L, 7L, 10L, request);

        assertThat(claim.getEtapeSuivi()).isEqualTo(EtapeSuiviSinistre.CLOTURE);
        assertThat(claim.getDateCloture()).isEqualTo(LocalDate.now());
        verify(events).recordStage(eq(claim), any(), eq(EtapeSuiviSinistre.EXPERTISE_APRES),
                eq(EtapeSuiviSinistre.CLOTURE), any());
    }

    @Test
    void reopeningRestoresEditableCompanyTrackingWithoutInventingAClientWait() {
        var claim = lifecycleClaim(StatutSinistre.CLOTURE, EtapeSuiviSinistre.CLOTURE);
        claim.setDateCloture(LocalDate.now().minusDays(1));
        var request = new TransitionSinistreRequest();
        request.setStatut(StatutSinistre.ROUVERT);
        request.setMotif("Réexamen compagnie");

        service.transition(1L, 7L, 10L, request);

        assertThat(claim.getEtapeSuivi()).isEqualTo(EtapeSuiviSinistre.COMPAGNIE);
        assertThat(claim.getDateCloture()).isNull();
        assertThat(workflow.isEditable(claim)).isTrue();
        verify(events).recordStage(eq(claim), any(), eq(EtapeSuiviSinistre.CLOTURE),
                eq(EtapeSuiviSinistre.COMPAGNIE), any());
    }

    @Test
    void administrativeTransmissionAlsoMovesTrackingToCompany() {
        var claim = lifecycleClaim(StatutSinistre.DECLARE, EtapeSuiviSinistre.INSTANCE_CLIENT);
        var request = new TransitionSinistreRequest();
        request.setStatut(StatutSinistre.TRANSMIS_COMPAGNIE);

        service.transition(1L, 7L, 10L, request);

        assertThat(claim.getEtapeSuivi()).isEqualTo(EtapeSuiviSinistre.COMPAGNIE);
        assertThat(claim.getDateTransmission()).isEqualTo(LocalDate.now());
        verify(events).recordStage(eq(claim), any(), eq(EtapeSuiviSinistre.INSTANCE_CLIENT),
                eq(EtapeSuiviSinistre.COMPAGNIE), any());
    }

    private Sinistre lifecycleClaim(StatutSinistre status, EtapeSuiviSinistre stage) {
        var agency = new Agence();
        agency.setId(1L);
        var client = Client.builder().agence(agency).nom("Assuré").build();
        client.setId(20L);
        var company = CompagnieAssurance.builder().code("CIE").nom("Compagnie").build();
        company.setId(30L);
        var claim = Sinistre.builder().agence(agency).numeroSinistre("SIN-26-0001")
                .client(client).compagnieAssurance(company).statut(status).etapeSuivi(stage).build();
        claim.setId(10L);
        when(claims.findByIdAndAgenceIdForUpdate(10L, 1L)).thenReturn(Optional.of(claim));
        when(mapper.toDetail(claim)).thenAnswer(call -> SinistreDetailResponse.builder()
                .id(10L).numeroSinistre(claim.getNumeroSinistre()).statut(claim.getStatut())
                .etapeSuivi(claim.getEtapeSuivi()).dateCloture(claim.getDateCloture())
                .dateTransmission(claim.getDateTransmission()).build());
        return claim;
    }
}
