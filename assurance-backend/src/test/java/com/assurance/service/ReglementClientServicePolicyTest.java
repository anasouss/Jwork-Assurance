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

    @Mock private com.assurance.repository.ContratRepository conventionContractRepository;
    @Mock private com.assurance.repository.EcheanceFacturationConventionRepository conventionScheduleRepository;
    @InjectMocks private FacturationConventionService conventionBilling;

    @Test
    void movementBillingModeOverridesTheOriginalContractForInvoiceAndCollectionRouting() {
        var contract = Contrat.builder().typeContrat(com.assurance.enums.TypeContrat.CONVENTION).modeReglement("facture").build();
        var movement = com.assurance.entity.MouvementContrat.builder().contrat(contract)
                .modeReglementConvention(com.assurance.enums.ModeReglementConvention.BUREAU).build();
        var element = ElementFacturable.builder().contrat(contract).mouvementContrat(movement).build();
        assertThat(ConventionPaymentPolicy.isInvoice(element)).isFalse();
        movement.setModeReglementConvention(com.assurance.enums.ModeReglementConvention.FACTURE);
        contract.setModeReglement("bureau");
        assertThat(ConventionPaymentPolicy.isInvoice(element)).isTrue();
        movement.setModeReglementConvention(null);
        assertThat(ConventionPaymentPolicy.isInvoice(element)).isFalse();
        contract.setModeReglement("facture");
        assertThat(ConventionPaymentPolicy.isInvoice(element)).isTrue();
    }

    @Test
    void amendmentInvoiceAllocationsCannotBeCountedInBothOriginalAndAmendmentSchedules() {
        var start = java.time.LocalDate.of(2026, 1, 1);
        var end = java.time.LocalDate.of(2026, 12, 31);
        var contract = Contrat.builder().typeContrat(com.assurance.enums.TypeContrat.CONVENTION)
                .modeReglement("facture").dateEffet(start).dateEcheance(end).build();
        var movement = com.assurance.entity.MouvementContrat.builder().contrat(contract)
                .statut(com.assurance.enums.StatutMouvementContrat.VALIDE)
                .modeReglementConvention(com.assurance.enums.ModeReglementConvention.FACTURE).build();
        movement.setId(50L);
        var element = ElementFacturable.builder().contrat(contract).mouvementContrat(movement)
                .actif(true).statut(com.assurance.enums.StatutElementFacturable.QUITTANCE)
                .dateDebut(start).dateFin(end).primeNette(new BigDecimal("80.00")).primeTotale(new BigDecimal("100.00")).build();
        var base = com.assurance.entity.EcheanceFacturationConvention.builder().contrat(contract).periodeDebut(start).periodeFin(end).build();
        var first = com.assurance.entity.EcheanceFacturationConvention.builder().contrat(contract).mouvement(movement)
                .sourceKey("MOUVEMENT-50").periodeDebut(start).periodeFin(java.time.LocalDate.of(2026, 6, 30)).build();
        var second = com.assurance.entity.EcheanceFacturationConvention.builder().contrat(contract).mouvement(movement)
                .sourceKey("MOUVEMENT-50").periodeDebut(java.time.LocalDate.of(2026, 7, 1)).periodeFin(end).build();
        var schedules = List.of(base, first, second);
        Object baseAmount = ReflectionTestUtils.invokeMethod(conventionBilling, "allocate", element, base, schedules);
        Object firstAmount = ReflectionTestUtils.invokeMethod(conventionBilling, "allocate", element, first, schedules);
        Object secondAmount = ReflectionTestUtils.invokeMethod(conventionBilling, "allocate", element, second, schedules);
        assertThat((BigDecimal) ReflectionTestUtils.invokeMethod(baseAmount, "ttc")).isEqualByComparingTo("0.00");
        BigDecimal firstTtc = ReflectionTestUtils.invokeMethod(firstAmount, "ttc");
        BigDecimal secondTtc = ReflectionTestUtils.invokeMethod(secondAmount, "ttc");
        assertThat(firstTtc.add(secondTtc)).isEqualByComparingTo("100.00");
        movement.setModeReglementConvention(com.assurance.enums.ModeReglementConvention.BUREAU);
        Object bureauAmount = ReflectionTestUtils.invokeMethod(conventionBilling, "allocate", element, first, schedules);
        assertThat((BigDecimal) ReflectionTestUtils.invokeMethod(bureauAmount, "ttc")).isEqualByComparingTo("0.00");
    }

    @Test
    void addingAnInvoiceAmendmentDoesNotRewriteAnIssuedContractSchedule() {
        var start = java.time.LocalDate.of(2026, 1, 1);
        var end = java.time.LocalDate.of(2026, 12, 31);
        var contract = Contrat.builder().typeContrat(com.assurance.enums.TypeContrat.CONVENTION)
                .modeReglement("facture").dateEffet(start).dateEcheance(end).build();
        contract.setId(10L);
        var movement = com.assurance.entity.MouvementContrat.builder().contrat(contract)
                .dateEffet(java.time.LocalDate.of(2026, 6, 1)).dateEcheance(end)
                .statut(com.assurance.enums.StatutMouvementContrat.VALIDE)
                .modeReglementConvention(com.assurance.enums.ModeReglementConvention.FACTURE).build();
        movement.setId(50L);
        contract.getMouvements().add(movement);
        var issued = com.assurance.entity.EcheanceFacturationConvention.builder().contrat(contract)
                .periodeDebut(start).periodeFin(end).numeroPeriode(1).nombrePeriodes(1)
                .statut(com.assurance.enums.StatutEcheanceFacturationConvention.FACTUREE).build();
        when(conventionContractRepository.findConventionInvoiceContracts(7L)).thenReturn(List.of(contract));
        when(conventionScheduleRepository.findByContratIdOrderByNumeroPeriodeAsc(10L)).thenReturn(List.of(issued));
        ReflectionTestUtils.invokeMethod(conventionBilling, "synchronizeSchedules", 7L);
        verify(conventionScheduleRepository).saveAll(org.mockito.ArgumentMatchers.argThat(rows -> {
            var list = new java.util.ArrayList<com.assurance.entity.EcheanceFacturationConvention>();
            rows.forEach(list::add);
            assertThat(list).hasSize(2).contains(issued);
            assertThat(list.stream().filter(row -> row.getMouvement() == movement).findFirst().orElseThrow().getSourceKey())
                    .isEqualTo("MOUVEMENT-50");
            return true;
        }));
        assertThat(issued.getStatut()).isEqualTo(com.assurance.enums.StatutEcheanceFacturationConvention.FACTUREE);
        assertThat(issued.getSourceKey()).isEqualTo("CONTRAT");
        assertThat(issued.getPeriodeDebut()).isEqualTo(start);
    }

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
