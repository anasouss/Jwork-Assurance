package com.assurance.service;

import com.assurance.dto.request.AddSinistreOperationRequest;
import com.assurance.entity.Agence;
import com.assurance.entity.Client;
import com.assurance.entity.CompagnieAssurance;
import com.assurance.entity.Sinistre;
import com.assurance.entity.SinistreOperation;
import com.assurance.entity.Utilisateur;
import com.assurance.enums.ModeReglementSinistre;
import com.assurance.enums.StatutSinistre;
import com.assurance.enums.TypeContrepartieSinistre;
import com.assurance.enums.TypeOperationSinistre;
import com.assurance.exception.BadRequestException;
import com.assurance.repository.ExpertSinistreRepository;
import com.assurance.repository.GarageSinistreRepository;
import com.assurance.repository.MissionExpertiseRepository;
import com.assurance.repository.ProvisionSinistreRepository;
import com.assurance.repository.SinistreGarantieRepository;
import com.assurance.repository.SinistreOperationRepository;
import com.assurance.repository.SinistrePartieRepository;
import com.assurance.repository.SinistreRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SinistreDossierServiceTest {

    private final SinistreRepository claims = mock(SinistreRepository.class);
    private final SinistreGarantieRepository guarantees = mock(SinistreGarantieRepository.class);
    private final SinistrePartieRepository parties = mock(SinistrePartieRepository.class);
    private final ProvisionSinistreRepository provisions = mock(ProvisionSinistreRepository.class);
    private final SinistreOperationRepository operations = mock(SinistreOperationRepository.class);
    private final MissionExpertiseRepository missions = mock(MissionExpertiseRepository.class);
    private final ExpertSinistreRepository experts = mock(ExpertSinistreRepository.class);
    private final GarageSinistreRepository garages = mock(GarageSinistreRepository.class);
    private final SinistreService claimService = mock(SinistreService.class);
    private final SinistreWorkflowService workflow = mock(SinistreWorkflowService.class);
    private final SinistreReadinessService readiness = mock(SinistreReadinessService.class);
    private final SinistreEvenementService events = mock(SinistreEvenementService.class);
    private final SinistreResponseMapper mapper = mock(SinistreResponseMapper.class);

    private final SinistreDossierService service = new SinistreDossierService(
            claims,
            guarantees,
            parties,
            provisions,
            operations,
            missions,
            experts,
            garages,
            claimService,
            workflow,
            readiness,
            events,
            mapper
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
    }

    @Test
    void nonCashOperationRequiresAReference() {
        AddSinistreOperationRequest request = operationRequest();
        request.setReference(null);

        assertThatThrownBy(() -> service.addOperation(1L, 7L, 35L, request))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("référence est obligatoire");
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
}
