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
import org.junit.jupiter.api.BeforeEach;
import com.assurance.activity.ActivityRecorderFixture;
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

    @Mock
    private com.assurance.repository.InstrumentReglementClientRepository recordedInstrumentRepository;

    @Mock private com.assurance.repository.ContratRepository conventionContractRepository;
    @Mock private com.assurance.repository.EcheanceFacturationConventionRepository conventionScheduleRepository;
    @Mock private com.assurance.repository.AgenceRepository conventionAgencyRepository;
    @Mock private com.assurance.repository.ElementFacturableRepository conventionElementRepository;
    @Mock private com.assurance.repository.ConventionRepository conventionRepository;
    @InjectMocks private FacturationConventionService conventionBilling;

    @BeforeEach
    void activityRecorder() {
        ReflectionTestUtils.setField(service, "businessActivityRecorder", new ActivityRecorderFixture().recorder);
    }

    @Test
    void recordedInstrumentSearchScopesEscapesAndBoundsTheRepositoryRequest() {
        when(recordedInstrumentRepository.searchRecordedReferences(eq(7L), eq("%ref!_!%!!%"),
                any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(org.springframework.data.domain.Page.empty());
        var result = service.searchRecordedInstruments(7L, " REF_%! ", null, null, null, null,
                null, null, "montantTotal", "asc", -2, 500);
        assertThat(result.getRows()).isEmpty();
        var pageable = org.mockito.ArgumentCaptor.forClass(org.springframework.data.domain.Pageable.class);
        verify(recordedInstrumentRepository).searchRecordedReferences(eq(7L), eq("%ref!_!%!!%"),
                any(), any(), any(), any(), any(), any(), pageable.capture());
        assertThat(pageable.getValue().getPageNumber()).isZero();
        assertThat(pageable.getValue().getPageSize()).isEqualTo(100);
        assertThat(pageable.getValue().getSort().getOrderFor("montant").isAscending()).isTrue();
    }

    @Test
    void recordedInstrumentSearchRejectsEmptyReferencesAndInvalidDates() {
        assertThatThrownBy(() -> service.searchRecordedInstruments(7L, " ", null, null, null, null,
                null, null, "numero", "desc", 0, 25)).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.searchRecordedInstruments(7L, "123", java.time.LocalDate.of(2026, 2, 1),
                java.time.LocalDate.of(2026, 1, 1), null, null, null, null, "numero", "desc", 0, 25))
                .isInstanceOf(BadRequestException.class);
        org.mockito.Mockito.verifyNoInteractions(recordedInstrumentRepository);
    }

    @Test
    void movementBillingModeOverridesTheOriginalContractForInvoiceAndCollectionRouting() {
        var contract = Contrat.builder().typeContrat(com.assurance.enums.TypeContrat.CONVENTION).modeReglement("facture").build();
        var movement = com.assurance.entity.MouvementContrat.builder().contrat(contract)
                .modeReglementConvention(com.assurance.enums.ModeReglementConvention.BUREAU).build();
        var element = ElementFacturable.builder().contrat(contract).mouvementContrat(movement)
                .nature(com.assurance.enums.NatureElementFacturable.MOUVEMENT_CONTRAT).build();
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
                .montantBulletin(new BigDecimal("1840.00"))
                .modeReglementConvention(com.assurance.enums.ModeReglementConvention.FACTURE).build();
        contract.setId(10L);
        movement.setId(50L);
        var element = ElementFacturable.builder().contrat(contract).mouvementContrat(movement)
                .nature(com.assurance.enums.NatureElementFacturable.MOUVEMENT_CONTRAT)
                .actif(true).statut(com.assurance.enums.StatutElementFacturable.QUITTANCE)
                .dateDebut(start).dateFin(end).primeNette(new BigDecimal("80.00")).primeTotale(new BigDecimal("100.00")).build();
        element.setId(20L);
        when(conventionElementRepository.findByContratIdInAndActifTrueOrderByDateDebutAscIdAsc(List.of(10L)))
                .thenReturn(List.of(element));
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
        assertThat(firstTtc).isEqualByComparingTo("920.00");
        assertThat(secondTtc).isEqualByComparingTo("920.00");
        assertThat(firstTtc.add(secondTtc)).isEqualByComparingTo("1840.00");
        movement.setModeReglementConvention(com.assurance.enums.ModeReglementConvention.BUREAU);
        Object bureauAmount = ReflectionTestUtils.invokeMethod(conventionBilling, "allocate", element, first, schedules);
        assertThat((BigDecimal) ReflectionTestUtils.invokeMethod(bureauAmount, "ttc")).isEqualByComparingTo("0.00");
    }

    @Test
    void periodPreparationReturnsAnEmptyDetailedPreviewForAnAlreadyBilledOrEmptyPeriod() {
        var convention = com.assurance.entity.Convention.builder().intitule("AOSFOC")
                .typeEcheance(com.assurance.enums.TypeEcheanceConvention.A_ECHEANCE).echeance("01/01")
                .fractionnement(com.assurance.enums.Fractionnement.TRIMESTRIEL).build();
        convention.setId(22L);
        when(conventionRepository.findByAgenceIdAndId(7L, 22L)).thenReturn(java.util.Optional.of(convention));
        when(conventionAgencyRepository.findByIdForUpdate(7L)).thenReturn(java.util.Optional.of(com.assurance.entity.Agence.builder().build()));
        when(conventionScheduleRepository.findPendingPeriod(7L, 22L, java.time.LocalDate.of(2026, 1, 1), java.time.LocalDate.of(2026, 3, 31)))
                .thenReturn(List.of());
        var result = conventionBilling.preparePeriod(7L, 22L, 2026, 1);
        assertThat(result.echeanceIds()).isEmpty();
        assertThat(result.apercu().convention()).isEqualTo("AOSFOC");
        assertThat(result.apercu().periodeDebut()).isEqualTo(java.time.LocalDate.of(2026, 1, 1));
        assertThat(result.apercu().periodeFin()).isEqualTo(java.time.LocalDate.of(2026, 3, 31));
        assertThat(result.apercu().lignes()).isEmpty();
        assertThat(result.apercu().total()).isEqualByComparingTo("0.00");
        verify(conventionScheduleRepository).findPendingPeriod(7L, 22L, java.time.LocalDate.of(2026, 1, 1), java.time.LocalDate.of(2026, 3, 31));
    }

    @Test
    void periodPreparationCannotUseAnotherAgencysConvention() {
        when(conventionRepository.findByAgenceIdAndId(7L, 22L)).thenReturn(java.util.Optional.empty());
        assertThatThrownBy(() -> conventionBilling.preparePeriod(7L, 22L, 2026, 1))
                .isInstanceOf(com.assurance.exception.ResourceNotFoundException.class);
        org.mockito.Mockito.verifyNoInteractions(conventionAgencyRepository, conventionScheduleRepository);
    }

    @Test
    void periodPreparationRejectsAQuarterForAnAnnualConvention() {
        var convention = com.assurance.entity.Convention.builder().typeEcheance(com.assurance.enums.TypeEcheanceConvention.A_ECHEANCE)
                .echeance("01/01").fractionnement(com.assurance.enums.Fractionnement.ANNUEL).build();
        when(conventionRepository.findByAgenceIdAndId(7L, 22L)).thenReturn(java.util.Optional.of(convention));
        assertThatThrownBy(() -> conventionBilling.preparePeriod(7L, 22L, 2026, 2)).isInstanceOf(BadRequestException.class);
        org.mockito.Mockito.verifyNoInteractions(conventionAgencyRepository, conventionScheduleRepository);
    }

    @Test
    void invoiceCannotOmitALineFromTheCurrentPeriod() {
        var convention = com.assurance.entity.Convention.builder().build();
        convention.setId(22L);
        var contract = Contrat.builder().convention(convention).build();
        var first = com.assurance.entity.EcheanceFacturationConvention.builder().contrat(contract)
                .periodeDebut(java.time.LocalDate.of(2026, 1, 1)).periodeFin(java.time.LocalDate.of(2026, 3, 31)).build();
        first.setId(1L);
        var second = com.assurance.entity.EcheanceFacturationConvention.builder().contrat(contract)
                .periodeDebut(first.getPeriodeDebut()).periodeFin(first.getPeriodeFin()).build();
        second.setId(2L);
        when(conventionScheduleRepository.findPendingPeriod(7L, 22L, first.getPeriodeDebut(), first.getPeriodeFin()))
                .thenReturn(List.of(first, second));
        assertThatThrownBy(() -> ReflectionTestUtils.invokeMethod(conventionBilling, "validateCompletePeriod", 7L, List.of(first)))
                .isInstanceOf(BadRequestException.class);
        org.assertj.core.api.Assertions.assertThatCode(() -> ReflectionTestUtils.invokeMethod(
                conventionBilling, "validateCompletePeriod", 7L, List.of(first, second))).doesNotThrowAnyException();
    }

    @Test
    void invoicePreviewNeverAcceptsAnIdOutsideTheCurrentAgency() {
        when(conventionScheduleRepository.findSelected(7L, List.of(99L))).thenReturn(List.of());
        assertThatThrownBy(() -> conventionBilling.preview(7L, List.of(99L))).isInstanceOf(BadRequestException.class);
        verify(conventionScheduleRepository).findSelected(7L, List.of(99L));
    }

    @Test
    void oneInvoiceCannotCombineConventionsOrBillingPeriods() {
        var convention = com.assurance.entity.Convention.builder().typeEcheance(com.assurance.enums.TypeEcheanceConvention.A_ECHEANCE)
                .echeance("01/01").fractionnement(com.assurance.enums.Fractionnement.TRIMESTRIEL).build();
        convention.setId(1L);
        var otherConvention = com.assurance.entity.Convention.builder().build();
        otherConvention.setId(2L);
        var first = com.assurance.entity.EcheanceFacturationConvention.builder().contrat(Contrat.builder().convention(convention).build())
                .periodeDebut(java.time.LocalDate.of(2026, 1, 1)).periodeFin(java.time.LocalDate.of(2026, 3, 31)).build();
        var second = com.assurance.entity.EcheanceFacturationConvention.builder().contrat(Contrat.builder().convention(otherConvention).build())
                .periodeDebut(first.getPeriodeDebut()).periodeFin(first.getPeriodeFin()).build();
        assertThatThrownBy(() -> ReflectionTestUtils.invokeMethod(conventionBilling, "validateSelection", List.of(first, second)))
                .isInstanceOf(BadRequestException.class);
        second.getContrat().setConvention(convention);
        second.setPeriodeDebut(java.time.LocalDate.of(2026, 4, 1));
        second.setPeriodeFin(java.time.LocalDate.of(2026, 6, 30));
        assertThatThrownBy(() -> ReflectionTestUtils.invokeMethod(conventionBilling, "validateSelection", List.of(first, second)))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void bulletinFromTheMailIsSplitEquallyIncludingThePartialFirstQuarter() {
        var start = java.time.LocalDate.of(2026, 2, 25);
        var end = java.time.LocalDate.of(2026, 12, 31);
        var contract = Contrat.builder().typeContrat(com.assurance.enums.TypeContrat.CONVENTION)
                .modeReglement("facture").montantBulletin(new BigDecimal("1840.00"))
                .dateEffet(start).dateEcheance(end).build();
        contract.setId(10L);
        var element = ElementFacturable.builder().contrat(contract).nature(com.assurance.enums.NatureElementFacturable.CONTRAT)
                .actif(true).statut(com.assurance.enums.StatutElementFacturable.QUITTANCE)
                .dateDebut(start).dateFin(end).primeNette(new BigDecimal("1500.00")).primeTotale(new BigDecimal("1700.00")).build();
        element.setId(20L);
        when(conventionElementRepository.findByContratIdInAndActifTrueOrderByDateDebutAscIdAsc(List.of(10L)))
                .thenReturn(List.of(element));
        var schedules = java.util.stream.IntStream.range(0, 4).mapToObj(index -> {
            var boundary = java.time.LocalDate.of(2026, 1, 1).plusMonths(index * 3L);
            return com.assurance.entity.EcheanceFacturationConvention.builder().contrat(contract)
                    .periodeDebut(boundary).periodeFin(boundary.plusMonths(3).minusDays(1)).build();
        }).toList();
        for (var schedule : schedules) {
            Object amount = ReflectionTestUtils.invokeMethod(conventionBilling, "allocate", element, schedule, schedules);
            assertThat((BigDecimal) ReflectionTestUtils.invokeMethod(amount, "ttc")).isEqualByComparingTo("460.00");
        }
        assertThat(element.getPrimeTotale()).isEqualByComparingTo("1700.00");
        contract.setMontantBulletin(new BigDecimal("999999999999.99"));
        element.setDateDebut(java.time.LocalDate.of(2026, 4, 25));
        var remaining = schedules.subList(1, 4);
        for (var schedule : remaining) {
            Object amount = ReflectionTestUtils.invokeMethod(conventionBilling, "allocate", element, schedule, remaining);
            assertThat((BigDecimal) ReflectionTestUtils.invokeMethod(amount, "ttc")).isEqualByComparingTo("333333333333.33");
        }
    }

    @Test
    void negativeMovementCapturesItsOwnBulletinRatherThanReusingTheOriginalContractAmount() {
        var contract = Contrat.builder().typeContrat(com.assurance.enums.TypeContrat.CONVENTION).modeReglement("facture")
                .montantBulletin(new BigDecimal("1840.00")).build();
        var response = com.assurance.dto.response.QuittanceResponse.builder().typeImpactMouvement("RETOUR_PRIME")
                .primeTotale(new BigDecimal("250.00")).build();
        var request = new com.assurance.dto.request.AvenantRequest();
        request.setModeReglement(com.assurance.enums.ModeReglementConvention.FACTURE);
        request.setMontantBulletin(new BigDecimal("200.00"));
        var movement = com.assurance.entity.MouvementContrat.builder().contrat(contract).build();
        ConventionPaymentPolicy.apply(contract, movement, request, response);
        assertThat(response.getRequiresConventionPayment()).isTrue();
        assertThat(movement.getMontantBulletin()).isEqualByComparingTo("200.00");
        assertThat(movement.getModeReglementConvention()).isEqualTo(com.assurance.enums.ModeReglementConvention.FACTURE);
        assertThat(contract.getMontantBulletin()).isEqualByComparingTo("1840.00");
    }

    @Test
    void assistanceRemainsASeparateSourceOutsideConventionBulletinBilling() {
        var contract = Contrat.builder().typeContrat(com.assurance.enums.TypeContrat.CONVENTION).modeReglement("facture").build();
        var assistance = ElementFacturable.builder().contrat(contract).nature(com.assurance.enums.NatureElementFacturable.ASSISTANCE).build();
        assertThat(ConventionPaymentPolicy.isInvoice(assistance)).isFalse();
    }

    @Test
    void pendingCountUsesTheFrontendJsonPropertyName() {
        var summary = com.assurance.dto.response.EcheanceFacturationConventionPageResponse.Summary.builder().aFacturer(20).build();
        var json = new com.fasterxml.jackson.databind.ObjectMapper().valueToTree(summary);
        assertThat(json.get("aFacturer").asInt()).isEqualTo(20);
    }

    @Test
    void addingAnInvoiceAmendmentDoesNotRewriteAnIssuedContractSchedule() {
        var start = java.time.LocalDate.of(2026, 1, 1);
        var end = java.time.LocalDate.of(2026, 12, 31);
        var contract = Contrat.builder().typeContrat(com.assurance.enums.TypeContrat.CONVENTION)
                .modeReglement("facture").dateEffet(start).dateEcheance(end)
                .convention(com.assurance.entity.Convention.builder().typeEcheance(com.assurance.enums.TypeEcheanceConvention.A_ECHEANCE)
                        .echeance("01/01").fractionnement(com.assurance.enums.Fractionnement.ANNUEL).build()).build();
        contract.setId(10L);
        var movement = com.assurance.entity.MouvementContrat.builder().contrat(contract)
                .dateEffet(java.time.LocalDate.of(2026, 6, 1)).dateEcheance(end)
                .statut(com.assurance.enums.StatutMouvementContrat.VALIDE)
                .modeReglementConvention(com.assurance.enums.ModeReglementConvention.FACTURE).build();
        movement.setId(50L);
        contract.getMouvements().add(movement);
        when(conventionElementRepository.findByContratIdInAndActifTrueOrderByDateDebutAscIdAsc(List.of(10L)))
                .thenReturn(List.of(ElementFacturable.builder().contrat(contract).mouvementContrat(movement)
                        .nature(com.assurance.enums.NatureElementFacturable.MOUVEMENT_CONTRAT)
                        .statut(com.assurance.enums.StatutElementFacturable.QUITTANCE).build()));
        var issued = com.assurance.entity.EcheanceFacturationConvention.builder().contrat(contract)
                .periodeDebut(start).periodeFin(end).numeroPeriode(1).nombrePeriodes(1)
                .statut(com.assurance.enums.StatutEcheanceFacturationConvention.FACTUREE).build();
        when(conventionContractRepository.findConventionInvoiceContracts(7L)).thenReturn(List.of(contract));
        when(conventionAgencyRepository.findByIdForUpdate(7L)).thenReturn(java.util.Optional.of(com.assurance.entity.Agence.builder().build()));
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
