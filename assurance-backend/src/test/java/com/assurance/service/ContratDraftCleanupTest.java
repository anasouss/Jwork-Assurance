package com.assurance.service;

import com.assurance.entity.AssistanceContrat;
import com.assurance.entity.Contrat;
import com.assurance.entity.ElementFacturable;
import com.assurance.entity.Quittance;
import com.assurance.entity.Usage;
import com.assurance.entity.Vehicule;
import com.assurance.dto.request.AvenantRequest;
import com.assurance.dto.request.CreateContratRequest;
import com.assurance.enums.ModeSaisieGarantieContrat;
import com.assurance.enums.TypeContrat;
import com.assurance.enums.TypeVehiculeContrat;
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

    @Test
    void initialAndRenewalSummariesKeepTheOriginalHeaderWhenLegacyTargetAttestationsAreEmpty() {
        for (var category : List.of(com.assurance.enums.CategorieMouvementContrat.AFFAIRE_NOUVELLE,
                com.assurance.enums.CategorieMouvementContrat.RENOUVELLEMENT)) {
            var response = com.assurance.dto.response.ContratResponse.builder()
                    .typeContrat(TypeContrat.CONVENTION).numeroAttestation("90A211049994")
                    .modeReglement("facture").numeroBonCommande("121")
                    .montantBulletin(new java.math.BigDecimal("1252.54"))
                    .vehicules(List.of(com.assurance.dto.response.ContratResponse.VehiculeView.builder()
                            .numeroAttestation(" ").build())).remorques(List.of()).build();
            var movement = new com.assurance.entity.MouvementContrat();
            movement.setTypeMouvement(com.assurance.entity.TypeMouvementContrat.builder().categorie(category).build());
            ReflectionTestUtils.invokeMethod(service, "applyMovementHeaderSnapshot", response, movement);
            assertThat(response.getNumeroAttestation()).isEqualTo("90A211049994");
            assertThat(response.getModeReglement()).isEqualTo("facture");
            assertThat(response.getNumeroBonCommande()).isEqualTo("121");
            assertThat(response.getMontantBulletin()).isEqualByComparingTo("1252.54");
            response.setVehicules(List.of(com.assurance.dto.response.ContratResponse.VehiculeView.builder()
                    .numeroAttestation("SAVED-SNAPSHOT").build()));
            ReflectionTestUtils.invokeMethod(service, "applyMovementHeaderSnapshot", response, movement);
            assertThat(response.getNumeroAttestation()).isEqualTo("SAVED-SNAPSHOT");
        }
    }

    @Test
    void initialVehicleSnapshotIsTakenAfterAttestationAssignmentAndNormalization() {
        var typeRepository = mock(TypeMouvementContratRepository.class);
        var movementRepository = mock(MouvementContratRepository.class);
        var snapshots = mock(MouvementVehiculeRepository.class);
        var stock = mock(AttestationStockService.class);
        var movements = new MouvementContratService(typeRepository, mock(ContratRepository.class), movementRepository,
                snapshots, mock(MouvementRemorqueRepository.class), mock(MouvementGarantieRepository.class),
                mock(QuittanceRepository.class), mock(LigneQuittanceRepository.class), stock,
                mock(QuittanceProductionService.class), mock(QuittanceCalculService.class), mock(ElementFacturableCibleService.class));
        var type = com.assurance.entity.TypeMouvementContrat.builder().code("AN").actif(true)
                .categorie(com.assurance.enums.CategorieMouvementContrat.AFFAIRE_NOUVELLE).genereQuittance(false).build();
        when(typeRepository.findByCodeIgnoreCase("AN")).thenReturn(java.util.Optional.of(type));
        when(movementRepository.save(any(com.assurance.entity.MouvementContrat.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(snapshots.save(any(com.assurance.entity.MouvementVehicule.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        var usage = Usage.builder().build();
        var contract = Contrat.builder().typeContrat(TypeContrat.CONVENTION).usage(usage)
                .numeroAttestation("211049994").build();
        var vehicle = Vehicule.builder().contrat(contract).usage(usage).typeVehicule(TypeVehiculeContrat.AUTOMOBILE).build();
        when(stock.normaliserNumero("211049994", contract, usage)).thenReturn("90A211049994");
        var zero = java.math.BigDecimal.ZERO;
        movements.creerAffaireNouvelle(contract, List.of(vehicle), List.of(), List.of(),
                new QuittanceCalculService.Resultat(List.of(), zero, zero, zero, zero, zero, zero));
        var captured = org.mockito.ArgumentCaptor.forClass(com.assurance.entity.MouvementVehicule.class);
        verify(snapshots).save(captured.capture());
        assertThat(captured.getValue().getNumeroAttestation()).isEqualTo("90A211049994");
        assertThat(vehicle.getNumeroAttestation()).isEqualTo("90A211049994");
        assertThat(contract.getNumeroAttestation()).isEqualTo("90A211049994");
    }

    @Test
    void amendmentSummaryUsesItsSavedAttestationAndPaymentFieldsInsteadOfTheParentHeader() {
        var response = com.assurance.dto.response.ContratResponse.builder()
                .typeContrat(TypeContrat.CONVENTION).numeroAttestation("90A195723197")
                .modeReglement("facture").numeroBonCommande("PARENT-ORDER")
                .montantBulletin(new java.math.BigDecimal("2455.04"))
                .vehicules(List.of(com.assurance.dto.response.ContratResponse.VehiculeView.builder()
                        .numeroAttestation("90A211050000").build()))
                .remorques(List.of()).build();
        var movement = new com.assurance.entity.MouvementContrat();
        movement.setTypeMouvement(com.assurance.entity.TypeMouvementContrat.builder()
                .code("CHV_M").categorie(com.assurance.enums.CategorieMouvementContrat.AVENANT).build());
        movement.setModeReglementConvention(com.assurance.enums.ModeReglementConvention.FACTURE);
        movement.setNumeroBonCommande("AMENDMENT-ORDER");
        movement.setMontantBulletin(new java.math.BigDecimal("38.54"));
        ReflectionTestUtils.invokeMethod(service, "applyMovementHeaderSnapshot", response, movement);
        assertThat(response.getNumeroAttestation()).isEqualTo("90A211050000");
        assertThat(response.getModeReglement()).isEqualTo("facture");
        assertThat(response.getNumeroBonCommande()).isEqualTo("AMENDMENT-ORDER");
        assertThat(response.getMontantBulletin()).isEqualByComparingTo("38.54");
    }

    @Test
    void legacyAmendmentSummaryDoesNotInventMissingPaymentFieldsOrAttestation() {
        var response = com.assurance.dto.response.ContratResponse.builder()
                .typeContrat(TypeContrat.CONVENTION).numeroAttestation("PARENT-ATTESTATION")
                .modeReglement("facture").numeroBonCommande("PARENT-ORDER")
                .montantBulletin(java.math.BigDecimal.TEN).vehicules(List.of()).remorques(List.of()).build();
        var movement = new com.assurance.entity.MouvementContrat();
        movement.setTypeMouvement(com.assurance.entity.TypeMouvementContrat.builder()
                .categorie(com.assurance.enums.CategorieMouvementContrat.AVENANT).build());
        ReflectionTestUtils.invokeMethod(service, "applyMovementHeaderSnapshot", response, movement);
        assertThat(response.getNumeroAttestation()).isNull();
        assertThat(response.getModeReglement()).isNull();
        assertThat(response.getNumeroBonCommande()).isNull();
        assertThat(response.getMontantBulletin()).isNull();
    }

    @Test
    void normalContractSummaryRemainsUnchangedAndTrailerSnapshotCanSupplyAttestation() {
        var response = com.assurance.dto.response.ContratResponse.builder()
                .typeContrat(TypeContrat.CONVENTION).numeroAttestation("ORIGINAL")
                .modeReglement("bureau").numeroBonCommande("ORIGINAL-ORDER")
                .montantBulletin(java.math.BigDecimal.TEN)
                .vehicules(List.of(com.assurance.dto.response.ContratResponse.VehiculeView.builder()
                        .numeroAttestation(" ").build()))
                .remorques(List.of(com.assurance.dto.response.ContratResponse.RemorqueView.builder()
                        .numeroAttestation("TRAILER-SNAPSHOT").build())).build();
        ReflectionTestUtils.invokeMethod(service, "applyMovementHeaderSnapshot", response, (Object) null);
        assertThat(response.getNumeroAttestation()).isEqualTo("ORIGINAL");
        assertThat(response.getNumeroBonCommande()).isEqualTo("ORIGINAL-ORDER");
        ReflectionTestUtils.invokeMethod(service, "applyMovementHeaderSnapshot", response, new com.assurance.entity.MouvementContrat());
        assertThat(response.getNumeroAttestation()).isEqualTo("TRAILER-SNAPSHOT");
        assertThat(response.getModeReglement()).isEqualTo("bureau");
        assertThat(response.getMontantBulletin()).isEqualByComparingTo(java.math.BigDecimal.TEN);
    }

    @Test
    void conventionAmendmentInheritsPaymentModeWithoutChangingTheOriginalContract() {
        var original = Contrat.builder().typeContrat(TypeContrat.CONVENTION).modeReglement("bureau")
                .numeroBonCommande("ORIGINAL").montantBulletin(new java.math.BigDecimal("9000.00")).build();
        var movement = new com.assurance.entity.MouvementContrat();
        ConventionPaymentPolicy.apply(original, movement, new AvenantRequest(),
                com.assurance.dto.response.QuittanceResponse.builder().primeTotale(new java.math.BigDecimal("100.00")).build());
        assertThat(movement.getModeReglementConvention()).isEqualTo(com.assurance.enums.ModeReglementConvention.BUREAU);
        assertThat(original.getModeReglement()).isEqualTo("bureau");
        assertThat(original.getNumeroBonCommande()).isEqualTo("ORIGINAL");
        assertThat(original.getMontantBulletin()).isEqualByComparingTo("9000.00");
    }

    @Test
    void conventionAmendmentInvoiceRequiresItsOwnOrderAndAmount() {
        var original = Contrat.builder().typeContrat(TypeContrat.CONVENTION).modeReglement("facture")
                .numeroBonCommande("OLD-ORDER").montantBulletin(new java.math.BigDecimal("9000")).build();
        var request = new AvenantRequest();
        var preview = com.assurance.dto.response.QuittanceResponse.builder().primeTotale(new java.math.BigDecimal("100")).build();
        assertThatThrownBy(() -> ConventionPaymentPolicy.apply(original, new com.assurance.entity.MouvementContrat(), request, preview))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("bon de commande");
        request.setNumeroBonCommande("NEW-ORDER");
        assertThatThrownBy(() -> ConventionPaymentPolicy.apply(original, new com.assurance.entity.MouvementContrat(), request, preview))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("bulletin");
        request.setMontantBulletin(new java.math.BigDecimal("100.00"));
        var movement = new com.assurance.entity.MouvementContrat();
        ConventionPaymentPolicy.apply(original, movement, request, preview);
        assertThat(movement.getModeReglementConvention()).isEqualTo(com.assurance.enums.ModeReglementConvention.FACTURE);
        assertThat(movement.getNumeroBonCommande()).isEqualTo("NEW-ORDER");
        assertThat(movement.getMontantBulletin()).isEqualByComparingTo("100.00");
        assertThat(original.getNumeroBonCommande()).isEqualTo("OLD-ORDER");
    }

    @Test
    void bureauOverrideDoesNotKeepInvoiceFieldsOrChangeAnInvoiceContract() {
        var original = Contrat.builder().typeContrat(TypeContrat.CONVENTION).modeReglement("facture").build();
        var request = new AvenantRequest();
        request.setModeReglement(com.assurance.enums.ModeReglementConvention.BUREAU);
        request.setNumeroBonCommande("IGNORED");
        request.setMontantBulletin(java.math.BigDecimal.TEN);
        var movement = new com.assurance.entity.MouvementContrat();
        ConventionPaymentPolicy.apply(original, movement, request,
                com.assurance.dto.response.QuittanceResponse.builder().primeTotale(java.math.BigDecimal.TEN).build());
        assertThat(movement.getModeReglementConvention()).isEqualTo(com.assurance.enums.ModeReglementConvention.BUREAU);
        assertThat(movement.getNumeroBonCommande()).isNull();
        assertThat(movement.getMontantBulletin()).isNull();
        assertThat(original.getModeReglement()).isEqualTo("facture");
    }

    @Test
    void zeroAndRefundAmendmentsDoNotRequirePaymentDetails() {
        var original = Contrat.builder().typeContrat(TypeContrat.CONVENTION).modeReglement("facture").build();
        for (var preview : List.of(
                com.assurance.dto.response.QuittanceResponse.builder().primeTotale(java.math.BigDecimal.ZERO).build(),
                com.assurance.dto.response.QuittanceResponse.builder().typeImpactMouvement("RETOUR_PRIME").primeTotale(java.math.BigDecimal.TEN).build(),
                com.assurance.dto.response.QuittanceResponse.builder().primeTotale(java.math.BigDecimal.TEN.negate()).build())) {
            var movement = new com.assurance.entity.MouvementContrat();
            ConventionPaymentPolicy.apply(original, movement, new AvenantRequest(), preview);
            assertThat(preview.getRequiresConventionPayment()).isFalse();
            assertThat(movement.getModeReglementConvention()).isNull();
        }
    }

    @Test
    void assistanceOnlyChargeStillRequiresAConventionPaymentChoice() {
        var original = Contrat.builder().typeContrat(TypeContrat.CONVENTION).modeReglement("bureau").build();
        var preview = com.assurance.dto.response.QuittanceResponse.builder().primeTotale(java.math.BigDecimal.ZERO)
                .assistances(List.of(com.assurance.dto.response.AssistanceContratResponse.builder().primeTotale(java.math.BigDecimal.TEN).build())).build();
        var movement = new com.assurance.entity.MouvementContrat();
        ConventionPaymentPolicy.apply(original, movement, new AvenantRequest(), preview);
        assertThat(preview.getRequiresConventionPayment()).isTrue();
        assertThat(movement.getModeReglementConvention()).isEqualTo(com.assurance.enums.ModeReglementConvention.BUREAU);
    }

    @Test
    void conventionPaymentFieldsAreRejectedForOtherContractTypes() {
        var request = new AvenantRequest();
        request.setModeReglement(com.assurance.enums.ModeReglementConvention.FACTURE);
        for (TypeContrat kind : List.of(TypeContrat.PARTICULIER, TypeContrat.FLOTTE)) {
            assertThatThrownBy(() -> ConventionPaymentPolicy.apply(Contrat.builder().typeContrat(kind).build(),
                    new com.assurance.entity.MouvementContrat(), request, com.assurance.dto.response.QuittanceResponse.builder().build()))
                    .isInstanceOf(BadRequestException.class);
        }
    }

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
        lenient().when(assistanceContratRepository.findByContratIdOrderByCreatedAtDesc(10L))
                .thenReturn(List.of(assistance));
    }

    @Test
    void conventionAmendmentCrmComesFromSharedContractValueNotTheSubmittedDraft() {
        contrat.setTypeContrat(TypeContrat.CONVENTION);
        contrat.setCrmPartage(true);
        contrat.setCrmPartageValeur(" 0.85 ");
        var vehicle = new CreateContratRequest.VehiculeInput();
        vehicle.setCrm("1.50");
        var request = new AvenantRequest();
        request.setVehicules(List.of(vehicle));
        var original = Vehicule.builder().crm("0.90").build();

        ReflectionTestUtils.invokeMethod(service, "inheritConventionAvenantVehicleCrm", contrat, request, List.of(original));

        assertThat(vehicle.getCrm()).isEqualTo("0.85");
        assertThat(original.getCrm()).isEqualTo("0.90");
    }

    @Test
    void conventionReplacementCrmUsesTheSuppliedBeforeVehicleRatherThanTheCurrentVehicle() {
        contrat.setTypeContrat(TypeContrat.CONVENTION);
        contrat.setCrmPartage(false);
        contrat.setCrmPartageValeur("1.20");
        contrat.getVehicules().add(Vehicule.builder().crm("1.50").build());
        var vehicle = new CreateContratRequest.VehiculeInput();
        vehicle.setCrm("1.50");
        var request = new AvenantRequest();
        request.setVehicules(List.of(vehicle));

        ReflectionTestUtils.invokeMethod(service, "inheritConventionAvenantVehicleCrm", contrat, request,
                List.of(Vehicule.builder().crm("0.90").build()));

        assertThat(vehicle.getCrm()).isEqualTo("0.90");
    }

    @Test
    void missingOriginalConventionCrmIsNotInventedFromTheRequest() {
        contrat.setTypeContrat(TypeContrat.CONVENTION);
        var vehicle = new CreateContratRequest.VehiculeInput();
        vehicle.setCrm("1.50");
        var request = new AvenantRequest();
        request.setVehicules(List.of(vehicle));

        ReflectionTestUtils.invokeMethod(service, "inheritConventionAvenantVehicleCrm", contrat, request,
                List.of(Vehicule.builder().crm(" ").build()));

        assertThat(vehicle.getCrm()).isNull();
    }

    @Test
    void conflictingOriginalConventionCrmsAreNotPickedArbitrarily() {
        contrat.setTypeContrat(TypeContrat.CONVENTION);
        var request = new AvenantRequest();
        request.setVehicules(List.of(new CreateContratRequest.VehiculeInput()));

        assertThatThrownBy(() -> ReflectionTestUtils.invokeMethod(service, "inheritConventionAvenantVehicleCrm", contrat, request,
                List.of(Vehicule.builder().crm("0.90").build(), Vehicule.builder().crm("1.10").build())))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Plusieurs CRM");
    }

    @Test
    void fleetAndMonoCrmsAreNotOverwrittenByConventionInheritance() {
        for (TypeContrat type : List.of(TypeContrat.FLOTTE, TypeContrat.PARTICULIER)) {
            contrat.setTypeContrat(type);
            var vehicle = new CreateContratRequest.VehiculeInput();
            vehicle.setCrm("1.50");
            var request = new AvenantRequest();
            request.setVehicules(List.of(vehicle));

            ReflectionTestUtils.invokeMethod(service, "inheritConventionAvenantVehicleCrm", contrat, request,
                    List.of(Vehicule.builder().crm("0.90").build()));

            assertThat(vehicle.getCrm()).isEqualTo("1.50");
        }
    }

    @Test
    void amendmentVehicleValidationDoesNotRequireCrmButCreationStillDoes() {
        Usage usage = new Usage();
        usage.setId(42L);
        usage.setActif(true);
        contrat.setTypeContrat(TypeContrat.CONVENTION);
        contrat.setUsage(usage);
        var vehicle = new CreateContratRequest.VehiculeInput();
        vehicle.setTypeVehicule(TypeVehiculeContrat.AUTOMOBILE);
        vehicle.setImmatriculation("67114-A-40");
        vehicle.setMarqueId(2L);
        vehicle.setCarrosserieId(3L);
        vehicle.setNombrePlaces("7");

        ReflectionTestUtils.invokeMethod(service, "validateDraftVehiculeInput", contrat, vehicle, false);
        assertThat(vehicle.getCrm()).isNull();
        assertThatThrownBy(() -> ReflectionTestUtils.invokeMethod(
                service, "validateDraftVehiculeInput", contrat, vehicle))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("CRM obligatoire");

        vehicle.setImmatriculation("");
        assertThatThrownBy(() -> ReflectionTestUtils.invokeMethod(
                service, "validateDraftVehiculeInput", contrat, vehicle, false))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Immatriculation obligatoire");
    }

    @Test
    void conventionAmendmentVehiclesInheritContractUsage() {
        Usage usage = new Usage();
        usage.setId(42L);
        contrat.setTypeContrat(TypeContrat.CONVENTION);
        contrat.setUsage(usage);
        var vehicle = new CreateContratRequest.VehiculeInput();
        var request = new AvenantRequest();
        request.setVehicules(List.of(vehicle));

        ReflectionTestUtils.invokeMethod(service, "inheritConventionAvenantVehicleUsage", contrat, request);

        assertThat(vehicle.getUsageId()).isEqualTo(42L);
        ReflectionTestUtils.invokeMethod(service, "inheritConventionAvenantVehicleUsage", contrat, request);
        assertThat(vehicle.getUsageId()).isEqualTo(42L);
    }

    @Test
    void conventionAmendmentCannotSwitchUsageThroughAVehicle() {
        Usage usage = new Usage();
        usage.setId(42L);
        contrat.setTypeContrat(TypeContrat.CONVENTION);
        contrat.setUsage(usage);
        var vehicle = new CreateContratRequest.VehiculeInput();
        vehicle.setUsageId(99L);
        var request = new AvenantRequest();
        request.setVehicules(List.of(vehicle));

        assertThatThrownBy(() -> ReflectionTestUtils.invokeMethod(
                service, "inheritConventionAvenantVehicleUsage", contrat, request))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("doit correspondre");
    }

    @Test
    void conventionAmendmentRequiresAnExistingContractUsage() {
        contrat.setTypeContrat(TypeContrat.CONVENTION);
        var request = new AvenantRequest();
        request.setVehicules(List.of(new CreateContratRequest.VehiculeInput()));

        assertThatThrownBy(() -> ReflectionTestUtils.invokeMethod(
                service, "inheritConventionAvenantVehicleUsage", contrat, request))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("usage du contrat convention");
    }

    @Test
    void fleetAndMonoAmendmentsKeepVehicleSpecificUsages() {
        for (TypeContrat type : List.of(TypeContrat.FLOTTE, TypeContrat.PARTICULIER)) {
            contrat.setTypeContrat(type);
            var vehicle = new CreateContratRequest.VehiculeInput();
            vehicle.setUsageId(99L);
            var request = new AvenantRequest();
            request.setVehicules(List.of(vehicle));

            ReflectionTestUtils.invokeMethod(service, "inheritConventionAvenantVehicleUsage", contrat, request);

            assertThat(vehicle.getUsageId()).isEqualTo(99L);
        }
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

    @Test
    void amendmentPrimeEntryOverridesDoNotMutateManagedContract() {
        contrat.setTypeContrat(TypeContrat.PARTICULIER);
        contrat.setSaisiePrimeNette(false);
        contrat.setModeSaisieGaranties(ModeSaisieGarantieContrat.MANUELLE);
        var request = new CreateContratRequest();
        request.setSaisiePrimeNette(true);

        Contrat pricing = ReflectionTestUtils.invokeMethod(service, "garantiePricingContext", contrat, request);

        assertThat(pricing).isNotSameAs(contrat);
        assertThat(pricing.getId()).isEqualTo(contrat.getId());
        assertThat(pricing.getSaisiePrimeNette()).isTrue();
        assertThat(pricing.getModeSaisieGaranties()).isEqualTo(ModeSaisieGarantieContrat.MANUELLE_AVEC_PRIME_NETTE);
        assertThat(contrat.getSaisiePrimeNette()).isFalse();
        assertThat(contrat.getModeSaisieGaranties()).isEqualTo(ModeSaisieGarantieContrat.MANUELLE);
    }

    @Test
    void amendmentCanDisableInheritedPrimeEntry() {
        contrat.setTypeContrat(TypeContrat.PARTICULIER);
        contrat.setSaisiePrimeNette(true);
        var request = new AvenantRequest();
        request.setSaisiePrimeNette(false);

        Boolean enabled = ReflectionTestUtils.invokeMethod(service, "createAmendmentPrimeSetting", contrat, request);

        assertThat(enabled).isFalse();
        assertThat(contrat.getSaisiePrimeNette()).isTrue();
    }

    @Test
    void primeEntryOverrideRejectsFleetContract() {
        contrat.setTypeContrat(TypeContrat.FLOTTE);
        var request = new AvenantRequest();
        request.setSaisiePrimeNette(true);

        assertThatThrownBy(() -> ReflectionTestUtils.invokeMethod(service, "createAmendmentPrimeSetting", contrat, request))
                .isInstanceOf(BadRequestException.class);
    }
}
