package com.assurance.service;

import com.assurance.exception.BadRequestException;
import com.assurance.dto.response.ReglementClientResponse;
import com.assurance.entity.AffectationReglementClient;
import com.assurance.entity.Contrat;
import com.assurance.entity.DocumentClient;
import com.assurance.entity.ElementFacturable;
import com.assurance.entity.InstrumentReglementClient;
import com.assurance.entity.LigneDocumentClient;
import com.assurance.entity.ReglementClient;
import com.assurance.enums.StatutAffectationReglement;
import com.assurance.enums.TypeDocumentClient;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReglementClientServicePolicyTest {

    @Mock
    private ParametreApplicationService parametreApplicationService;

    @InjectMocks
    private ReglementClientService service;

    @Test
    void allocationResponseSeparatesPolicyMovementAndDocumentWithoutParsingLabels() {
        Contrat contract = Contrat.builder().numeroPolice("POL-001").numeroDossier("DOS-001").build();
        ElementFacturable element = ElementFacturable.builder().contrat(contract)
                .libelle("Extension · garanties").build();
        AffectationReglementClient allocation = AffectationReglementClient.builder()
                .elementFacturable(element).montant(new BigDecimal("50.00"))
                .statut(StatutAffectationReglement.ANNULEE).build();
        ReglementClientResponse.Affectation response = allocationResponse(allocation);
        assertThat(response.getNumeroPolice()).isEqualTo("POL-001");
        assertThat(response.getMouvement()).isEqualTo("Extension · garanties");
        assertThat(response.getReferenceDocument()).isNull();
        assertThat(response.getMontant()).isEqualByComparingTo("50.00");
        assertThat(response.getStatut()).isEqualTo(StatutAffectationReglement.ANNULEE);
    }

    @Test
    void globalDocumentAllocationKeepsSnapshotPoliciesAndOneAllocationAmount() {
        DocumentClient invoice = DocumentClient.builder().typeDocument(TypeDocumentClient.FACTURE)
                .numero("FAC-001").build();
        invoice.getLignes().add(LigneDocumentClient.builder().numeroPolice("POL-SNAPSHOT-1").build());
        invoice.getLignes().add(LigneDocumentClient.builder().numeroPolice("POL-SNAPSHOT-2").build());
        AffectationReglementClient allocation = AffectationReglementClient.builder()
                .documentClient(invoice).montant(new BigDecimal("100.00"))
                .statut(StatutAffectationReglement.EN_ATTENTE).build();
        ReglementClientResponse.Affectation response = allocationResponse(allocation);
        assertThat(response.getNumeroPolice()).isEqualTo("POL-SNAPSHOT-1\nPOL-SNAPSHOT-2");
        assertThat(response.getMouvement()).isEqualTo("Affectation globale au document");
        assertThat(response.getReferenceDocument()).isEqualTo("Facture FAC-001");
        assertThat(response.getMontant()).isEqualByComparingTo("100.00");
    }

    private ReglementClientResponse.Affectation allocationResponse(AffectationReglementClient allocation) {
        InstrumentReglementClient instrument = InstrumentReglementClient.builder()
                .reglement(ReglementClient.builder().build()).affectations(List.of(allocation)).build();
        ReglementClientResponse.Instrument response = ReflectionTestUtils.invokeMethod(
                service, "toInstrumentResponse", instrument, null);
        assertThat(response).isNotNull();
        assertThat(response.getAffectations()).hasSize(1);
        return response.getAffectations().get(0);
    }

    @Test
    void returnsTheAgencyUnallocatedCreditLimit() {
        when(parametreApplicationService.getDecimal(eq(7L), anyString(), any()))
                .thenReturn(new BigDecimal("75.50"));

        var policy = service.paymentPolicy(7L);

        assertThat(policy.getCreditNonAffecteMaximum()).isEqualByComparingTo("75.50");
    }

    @Test
    void savesTheAgencyUnallocatedCreditLimitAtMoneyPrecision() {
        var policy = service.updatePaymentPolicy(7L, new BigDecimal("25.126"));

        assertThat(policy.getCreditNonAffecteMaximum()).isEqualByComparingTo("25.13");
        verify(parametreApplicationService).setValeur(
                eq(7L),
                anyString(),
                eq("DECIMAL"),
                eq("25.13"),
                anyString()
        );
    }

    @Test
    void adjustmentLimitDefaultsToDisabledAndCanBeConfiguredSeparately() {
        assertThat(service.paymentPolicy(7L).getEcartReglementMaximum()).isZero();
        var policy = service.updatePaymentPolicy(7L, new BigDecimal("100.00"), new BigDecimal("10.00"));
        assertThat(policy.getEcartReglementMaximum()).isEqualByComparingTo("10.00");
        verify(parametreApplicationService).setValeur(7L, "REGLEMENT_CLIENT_ECART_MAX", "DECIMAL", "10.00",
                "Écart de règlement maximal accordé par règlement client");
    }

    @Test
    void rejectsANegativeLimit() {
        assertThatThrownBy(() -> service.updatePaymentPolicy(7L, new BigDecimal("-0.01")))
                .isInstanceOf(BadRequestException.class);
    }
}
