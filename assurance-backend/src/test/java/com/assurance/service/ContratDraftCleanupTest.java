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
