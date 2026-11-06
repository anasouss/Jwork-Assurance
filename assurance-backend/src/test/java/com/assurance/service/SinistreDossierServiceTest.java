package com.assurance.service;

import com.assurance.dto.request.AddSinistreOperationRequest;
import com.assurance.dto.response.SinistreDetailResponse;
import com.assurance.activity.ActivityAction;
import com.assurance.activity.ActivityModule;
import com.assurance.activity.ActivityRecordType;
import com.assurance.activity.ActivityRecorderFixture;
import com.assurance.activity.ClaimActivity;
import com.assurance.entity.Agence;
import com.assurance.entity.Client;
import com.assurance.entity.CompagnieAssurance;
import com.assurance.entity.Sinistre;
import com.assurance.entity.SinistreOperation;
import com.assurance.entity.CompteTresorerie;
import com.assurance.entity.OperationTresorerie;
import com.assurance.entity.Utilisateur;
import com.assurance.enums.ModeReglementSinistre;
import com.assurance.enums.CircuitFinancierSinistre;
import com.assurance.enums.StatutSinistre;
import com.assurance.enums.TypeContrepartieSinistre;
import com.assurance.enums.TypeOperationSinistre;
import com.assurance.exception.BadRequestException;
import com.assurance.repository.ExpertSinistreRepository;
import com.assurance.repository.GarageSinistreRepository;
import com.assurance.repository.MissionExpertiseRepository;
import com.assurance.repository.ProvisionSinistreRepository;
import com.assurance.repository.SinistreCouvertureRepository;
import com.assurance.repository.SinistreDocumentRepository;
import com.assurance.repository.SinistreEvenementRepository;
import com.assurance.repository.SinistreGarantieRepository;
import com.assurance.repository.SinistreOperationRepository;
import com.assurance.repository.SinistrePartieRepository;
import com.assurance.repository.SinistreRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;

class SinistreDossierServiceTest {

    private final SinistreRepository claims = mock(SinistreRepository.class);
    private final SinistreGarantieRepository guarantees = mock(SinistreGarantieRepository.class);
    private final SinistrePartieRepository parties = mock(SinistrePartieRepository.class);
    private final ProvisionSinistreRepository provisions = mock(ProvisionSinistreRepository.class);
    private final SinistreOperationRepository operations = mock(SinistreOperationRepository.class);
    private final SinistreDocumentRepository documents = mock(SinistreDocumentRepository.class);
    private final SinistreEvenementRepository claimEvents = mock(SinistreEvenementRepository.class);
    private final SinistreCouvertureRepository coverage = mock(SinistreCouvertureRepository.class);
    private final MissionExpertiseRepository missions = mock(MissionExpertiseRepository.class);
    private final ExpertSinistreRepository experts = mock(ExpertSinistreRepository.class);
    private final GarageSinistreRepository garages = mock(GarageSinistreRepository.class);
    private final SinistreService claimService = mock(SinistreService.class);
    private final SinistreWorkflowService workflow = mock(SinistreWorkflowService.class);
    private final SinistreReadinessService readiness = mock(SinistreReadinessService.class);
    private final SinistreEvenementService events = mock(SinistreEvenementService.class);
    private final SinistreResponseMapper mapper = mock(SinistreResponseMapper.class);
    private final OperationTresorerieService treasuryOperations = mock(OperationTresorerieService.class);
    private final ActivityRecorderFixture activity = new ActivityRecorderFixture();
    private final List<SinistreOperation> savedOperations = new ArrayList<>();

    private final SinistreDossierService service = new SinistreDossierService(
            claims,
            guarantees,
            parties,
            provisions,
            operations,
            documents,
            claimEvents,
            coverage,
            missions,
            experts,
            garages,
            claimService,
            workflow,
            readiness,
            events,
            mapper,
            treasuryOperations,
            activity.recorder
    );

    private Sinistre claim;

    @BeforeEach
    void setUp() {
        Agence agency = new Agence();
        agency.setId(1L);
        Client client = Client.builder()
                .agence(agency)
                .prenom("Nadia")
                .nom("Laguir")
                .build();
        client.setId(10L);
        CompagnieAssurance insurer = CompagnieAssurance.builder()
                .code("MATU")
                .nom("MATU")
                .build();
        insurer.setId(4L);
        claim = Sinistre.builder()
                .agence(agency)
                .client(client)
                .compagnieAssurance(insurer)
                .numeroSinistre("SIN-26-000035")
                .statut(StatutSinistre.EN_ATTENTE_REGLEMENT)
                .dateSinistre(LocalDate.now().minusDays(2))
                .build();
        claim.setId(35L);

        Utilisateur user = new Utilisateur();
        user.setId(7L);
        when(claimService.resolve(1L, 35L)).thenReturn(claim);
        when(claimService.resolveCurrentUser(1L, 7L)).thenReturn(user);
        when(workflow.isEditable(StatutSinistre.EN_ATTENTE_REGLEMENT)).thenReturn(true);
        when(readiness.totalIndemnisable(35L)).thenReturn(new BigDecimal("1000.00"));
        when(readiness.totalSettled(35L)).thenReturn(BigDecimal.ZERO);
        when(operations.save(any())).thenAnswer(call -> {
            SinistreOperation operation = call.getArgument(0);
            operation.setId(100L + savedOperations.size());
            savedOperations.add(operation);
            return operation;
        });
        when(mapper.toDetail(claim)).thenAnswer(call -> SinistreDetailResponse.builder()
                .id(claim.getId()).numeroSinistre(claim.getNumeroSinistre()).statut(claim.getStatut())
                .operations(savedOperations.stream().map(operation -> SinistreDetailResponse.Operation.builder()
                        .id(operation.getId()).type(operation.getType()).dateOperation(operation.getDateOperation())
                        .montant(operation.getMontant()).reference(operation.getReference())
                        .contrepartie(operation.getContrepartieNomSnapshot()).typeContrepartie(operation.getTypeContrepartie())
                        .modeReglement(operation.getModeReglement()).circuitFinancier(operation.getCircuitFinancier())
                        .build()).toList()).build());
    }

    @Test
    void operationStoresClaimInsurerAndNormalizedClientCounterparty() {
        AddSinistreOperationRequest request = operationRequest();

        service.addOperation(1L, 7L, 35L, request);

        ArgumentCaptor<SinistreOperation> captor = ArgumentCaptor.forClass(SinistreOperation.class);
        verify(operations).save(captor.capture());
        SinistreOperation saved = captor.getValue();
        assertThat(saved.getCompagnieAssurance()).isSameAs(claim.getCompagnieAssurance());
        assertThat(saved.getTypeContrepartie()).isEqualTo(TypeContrepartieSinistre.CLIENT);
        assertThat(saved.getContrepartieClient()).isSameAs(claim.getClient());
        assertThat(saved.getContrepartieNomSnapshot()).isEqualTo("Nadia Laguir");
        assertThat(saved.getModeReglement()).isEqualTo(ModeReglementSinistre.VIREMENT);
        assertThat(saved.getCircuitFinancier()).isEqualTo(CircuitFinancierSinistre.DIRECT_COMPAGNIE);
        assertThat(saved.getOperationTresorerie()).isNull();
        verify(activity.events).save(argThat(event -> event.getModule() == ActivityModule.SINISTRES
                && event.getSubjectType() == ActivityRecordType.OPERATION_SINISTRE
                && event.getChangesJson().contains("Direct compagnie")));
    }

    @Test
    void nonCashOperationRequiresAReference() {
        AddSinistreOperationRequest request = operationRequest();
        request.setReference(null);

        assertThatThrownBy(() -> service.addOperation(1L, 7L, 35L, request))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("référence est obligatoire");
        verifyNoInteractions(activity.events);
    }

    @Test
    void agencyTreasuryCircuitLinksTheAuthoritativeTreasuryOperation() {
        AddSinistreOperationRequest request = operationRequest();
        request.setCircuitFinancier(CircuitFinancierSinistre.TRESORERIE_AGENCE);
        request.setCompteTresorerieId(91L);
        CompteTresorerie account = CompteTresorerie.builder().libelle("Banque principale").build();
        account.setId(91L);
        OperationTresorerie treasuryOperation = OperationTresorerie.builder()
                .compteSource(account)
                .numero("TR-001-2026-000001")
                .build();
        when(treasuryOperations.createClaimMovement(
                1L,
                91L,
                TypeOperationSinistre.REGLEMENT,
                ModeReglementSinistre.VIREMENT,
                new BigDecimal("250.00"),
                request.getDateOperation(),
                request.getReference(),
                claim.getNumeroSinistre(),
                "Nadia Laguir"
        )).thenReturn(treasuryOperation);

        service.addOperation(1L, 7L, 35L, request);

        ArgumentCaptor<SinistreOperation> captor = ArgumentCaptor.forClass(SinistreOperation.class);
        verify(operations).save(captor.capture());
        assertThat(captor.getValue().getCompteTresorerie()).isSameAs(account);
        assertThat(captor.getValue().getOperationTresorerie()).isSameAs(treasuryOperation);
    }

    private AddSinistreOperationRequest operationRequest() {
        AddSinistreOperationRequest request = new AddSinistreOperationRequest();
        request.setType(TypeOperationSinistre.REGLEMENT);
        request.setDateOperation(LocalDate.now().minusDays(1));
        request.setMontant(new BigDecimal("250.00"));
        request.setReference("VIR-2026-001");
        request.setTypeContrepartie(TypeContrepartieSinistre.CLIENT);
        request.setModeReglement(ModeReglementSinistre.VIREMENT);
        return request;
    }

    @Test
    void deletingOnePartyDoesNotReportUnchangedRemainingPartyAsModified() {
        var first = SinistreDetailResponse.Partie.builder().id(1L).nom("Amine").build();
        var remaining = SinistreDetailResponse.Partie.builder().id(2L).nom("Nadia").build();
        var before = ClaimActivity.snapshot(SinistreDetailResponse.builder().numeroSinistre(claim.getNumeroSinistre())
                .parties(List.of(first, remaining)).build());
        var after = SinistreDetailResponse.builder().numeroSinistre(claim.getNumeroSinistre()).parties(List.of(remaining)).build();
        var command = ClaimActivity.target(ClaimActivity.command(claim, before, after, ActivityAction.DELETED,
                "Partie retiree du sinistre", "CLAIM_PARTY_REMOVAL"), before, after, ActivityRecordType.PARTIE_SINISTRE, 1L);
        assertThat(command.subject().type()).isEqualTo(ActivityRecordType.PARTIE_SINISTRE);
        assertThat(command.references()).anyMatch(reference -> reference.type() == ActivityRecordType.SINISTRE);
        assertThat(command.changes()).allMatch(change -> !change.label().contains("Nadia"));
    }
}
