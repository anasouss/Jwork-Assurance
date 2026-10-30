package com.assurance.service;

import com.assurance.entity.AssistanceContrat;
import com.assurance.entity.Contrat;
import com.assurance.entity.ElementFacturable;
import com.assurance.entity.Quittance;
import com.assurance.exception.BadRequestException;
import com.assurance.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ContratDraftCleanupTest {

    @Mock private AssistanceContratRepository assistanceContratRepository;
    @Mock private QuittanceRepository quittanceRepository;
    @Mock private LigneDocumentClientRepository ligneDocumentClientRepository;
    @Mock private AffectationReglementClientRepository affectationReglementClientRepository;
    @Mock private AffectationQuittanceCompagnieRepository affectationQuittanceCompagnieRepository;
    @Mock private ElementFacturableRepository elementFacturableRepository;
    @Mock private ElementFacturableCibleRepository elementFacturableCibleRepository;
    @Mock private ContratGarantieRepository contratGarantieRepository;
    @Mock private ContratClientRepository contratClientRepository;
    @Mock private RemorqueRepository remorqueRepository;
    @Mock private VehiculeRepository vehiculeRepository;
    @InjectMocks private ContratService service;

    private Contrat contrat;
    private ElementFacturable element;
    private Quittance quittance;
    private AssistanceContrat assistance;

    @BeforeEach
    void setUp() {
        contrat = Contrat.builder().build();
        contrat.setId(10L);
        element = ElementFacturable.builder().contrat(contrat).build();
        element.setId(20L);
        quittance = Quittance.builder().contrat(contrat).elementFacturable(element).build();
        quittance.setId(30L);
        assistance = AssistanceContrat.builder().contrat(contrat).elementFacturable(element).build();
        contrat.getQuittances().add(quittance);
        contrat.getElementsFacturables().add(element);
        contrat.getAssistances().add(assistance);
        when(assistanceContratRepository.findByContratIdOrderByCreatedAtDesc(10L))
                .thenReturn(List.of(assistance));
    }

    @Test
    void deletesUnusedQuittancesBeforeBillableElements() {
        when(quittanceRepository.findByContrat_IdAndElementFacturable_IdOrderByCreatedAtDesc(10L, 20L))
                .thenReturn(List.of(quittance));

        ReflectionTestUtils.invokeMethod(service, "clearDraftChildren", contrat);

        var order = inOrder(quittanceRepository, assistanceContratRepository,
                elementFacturableCibleRepository, elementFacturableRepository);
        order.verify(quittanceRepository).deleteAll(List.of(quittance));
        order.verify(quittanceRepository).flush();
        order.verify(assistanceContratRepository).deleteAll(List.of(assistance));
        order.verify(assistanceContratRepository).flush();
        order.verify(elementFacturableCibleRepository).deleteByElementFacturableId(20L);
        order.verify(elementFacturableCibleRepository).flush();
        order.verify(elementFacturableRepository).deleteAll(List.of(element));
        assertThat(contrat.getQuittances()).isEmpty();
    }

    @Test
    void refusesToDeleteCompanyAllocatedQuittance() {
        when(quittanceRepository.findByContrat_IdAndElementFacturable_IdOrderByCreatedAtDesc(10L, 20L))
                .thenReturn(List.of(quittance));
        when(affectationQuittanceCompagnieRepository.existsByQuittanceId(30L)).thenReturn(true);

        assertBlocked();
    }

    @Test
    void refusesToDeleteElementWithPaymentHistory() {
        when(affectationReglementClientRepository.existsByElementFacturableId(20L)).thenReturn(true);

        assertBlocked();
    }

    @Test
    void refusesToDeleteElementLinkedToClientDocument() {
        when(ligneDocumentClientRepository.existsByElementFacturableId(20L)).thenReturn(true);

        assertBlocked();
    }

    @Test
    void refusesToDeletePaidQuittance() {
        quittance.setPayee(true);
        when(quittanceRepository.findByContrat_IdAndElementFacturable_IdOrderByCreatedAtDesc(10L, 20L))
                .thenReturn(List.of(quittance));

        assertBlocked();
    }

    private void assertBlocked() {
        assertThatThrownBy(() -> ReflectionTestUtils.invokeMethod(service, "clearDraftChildren", contrat))
                .isInstanceOf(BadRequestException.class);
        verify(quittanceRepository, never()).deleteAll(anyIterable());
        verify(assistanceContratRepository, never()).deleteAll(anyIterable());
        verifyNoInteractions(elementFacturableRepository);
    }
}
