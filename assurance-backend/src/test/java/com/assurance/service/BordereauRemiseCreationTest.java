package com.assurance.service;

import com.assurance.dto.request.CreerBordereauRemiseRequest;
import com.assurance.dto.request.DeposerBordereauRemiseRequest;
import com.assurance.activity.PaymentActivity;
import com.assurance.activity.ActivityRecorderFixture;
import com.assurance.activity.ActivityAction;
import com.assurance.dto.response.BordereauRemiseResponse;
import com.assurance.entity.Agence;
import com.assurance.entity.BordereauRemise;
import com.assurance.entity.CompteTresorerie;
import com.assurance.entity.InstrumentReglementClient;
import com.assurance.entity.LigneBordereauRemise;
import com.assurance.entity.MouvementTresorerie;
import com.assurance.entity.ReglementClient;
import com.assurance.enums.ModeReglementClient;
import com.assurance.enums.NatureCaisseTresorerie;
import com.assurance.enums.NatureMouvementTresorerie;
import com.assurance.enums.SensMouvementTresorerie;
import com.assurance.enums.StatutBordereauRemise;
import com.assurance.enums.StatutInstrumentReglement;
import com.assurance.enums.StatutLigneBordereauRemise;
import com.assurance.enums.StatutReglementClient;
import com.assurance.enums.TypeBordereauRemise;
import com.assurance.enums.TypeCompteTresorerie;
import com.assurance.repository.AgenceRepository;
import com.assurance.repository.BordereauRemiseRepository;
import com.assurance.repository.InstrumentReglementClientRepository;
import com.assurance.repository.LigneBordereauEspecesRepository;
import com.assurance.repository.LigneBordereauRemiseRepository;
import com.assurance.repository.MouvementTresorerieRepository;
import com.assurance.repository.OperationTresorerieRepository;
import com.assurance.repository.SequenceBordereauRemiseRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doAnswer;

class BordereauRemiseCreationTest {
    private static final Long AGENCY_ID = 7L;
    private static final LocalDate DATE = LocalDate.of(2026, 10, 31);
    private final BordereauRemiseRepository slips = mock(BordereauRemiseRepository.class);
    private final MouvementTresorerieRepository movements = mock(MouvementTresorerieRepository.class);
    private final OperationTresorerieRepository operations = mock(OperationTresorerieRepository.class);
    private final InstrumentReglementClientRepository instruments = mock(InstrumentReglementClientRepository.class);
    private final AgenceRepository agencies = mock(AgenceRepository.class);
    private final TresorerieService treasury = mock(TresorerieService.class);
    private final OperationTresorerieService transfers = mock(OperationTresorerieService.class);
    private final ReglementClientService payments = mock(ReglementClientService.class);
    private final ActivityRecorderFixture activity = new ActivityRecorderFixture();
    private final BordereauRemiseService service = new BordereauRemiseService(
            slips, mock(LigneBordereauRemiseRepository.class), mock(LigneBordereauEspecesRepository.class),
            movements, operations, mock(SequenceBordereauRemiseRepository.class), instruments, agencies,
            treasury, transfers, payments, activity.recorder);
    private final Agence agency = Agence.builder().nom("Cabinet test").build();

    @BeforeEach
    void setup() {
        agency.setId(AGENCY_ID);
        CompteTresorerie bank = CompteTresorerie.builder().agence(agency).libelle("Banque")
                .typeCompte(TypeCompteTresorerie.BANQUE).build();
        bank.setId(2L);
        when(treasury.findAccount(AGENCY_ID, 2L)).thenReturn(bank);
        when(agencies.findByIdForUpdate(AGENCY_ID)).thenReturn(Optional.of(agency));
        when(slips.saveAndFlush(any())).thenAnswer(call -> {
            BordereauRemise slip = call.getArgument(0);
            slip.setId(100L);
            return slip;
        });
    }

    @ParameterizedTest
    @EnumSource(TypeBordereauRemise.class)
    void everyTypeIsCreatedProvisionalWithoutMovingFunds(TypeBordereauRemise type) {
        CreerBordereauRemiseRequest request = request(type);
        InstrumentReglementClient instrument = null;
        if (type == TypeBordereauRemise.VERSEMENT_ESPECES) {
            prepareCash();
        } else {
            instrument = prepareInstrument(type);
        }

        BordereauRemiseResponse created = service.create(AGENCY_ID, request);
        assertProvisional(created);
        if (instrument != null) {
            assertThat(instrument.getStatut()).isEqualTo(StatutInstrumentReglement.EN_ATTENTE);
            assertThat(created.getLignes()).singleElement().satisfies(line -> {
                assertThat(line.getStatut()).isEqualTo(StatutLigneBordereauRemise.PREPAREE);
                assertThat(line.getDateTraitement()).isNull();
            });
        } else {
            assertThat(created.getLignesEspeces()).singleElement()
                    .satisfies(line -> assertThat(line.getOperationTresorerieId()).isNull());
        }
        verifyNoInteractions(transfers, payments, operations);
        verify(movements, never()).save(any());
        verify(activity.events).save(org.mockito.ArgumentMatchers.argThat(event ->
                event.getAction() == ActivityAction.CREATED && event.getTitle().contains("provisoire")));
    }

    @Test
    void dedicatedCashEndpointAlsoOnlyCreatesAProvisionalSlip() {
        prepareCash();
        assertProvisional(service.createCashDeposit(AGENCY_ID, request(TypeBordereauRemise.VERSEMENT_ESPECES)));
        verifyNoInteractions(transfers, payments, operations);
        verify(movements, never()).save(any());
    }

    @Test
    void depositingASlipGroupsItsInstrumentTransitionsIntoOneBusinessActivity() {
        InstrumentReglementClient instrument = prepareInstrument(TypeBordereauRemise.CHEQUE);
        var destination = treasury.findAccount(AGENCY_ID, 2L);
        BordereauRemise slip = BordereauRemise.builder().agence(agency).numero("BRC-2026-000001")
                .type(TypeBordereauRemise.CHEQUE).dateBordereau(DATE).compteDestination(destination)
                .montantTotal(new BigDecimal("100.00")).build();
        slip.setId(100L);
        slip.getLignes().add(LigneBordereauRemise.builder().bordereau(slip).instrument(instrument)
                .montant(instrument.getMontant()).statut(StatutLigneBordereauRemise.PREPAREE).build());
        when(slips.findByIdAndAgenceIdForUpdate(100L, AGENCY_ID)).thenReturn(Optional.of(slip));
        doAnswer(call -> {
            var before = PaymentActivity.instrumentSnapshot(instrument);
            instrument.setStatut(StatutInstrumentReglement.REMIS_EN_BANQUE);
            activity.recorder.record(PaymentActivity.instrumentCommand(instrument, before, ActivityAction.REMITTED,
                    "Moyen remis en banque", "PAYMENT_BANK_REMITTANCE"));
            return null;
        }).when(payments).markInstrumentRemitted(AGENCY_ID, instrument.getId(), 2L, DATE);
        var request = new DeposerBordereauRemiseRequest();
        request.setDateDepot(DATE);
        request.setReferenceBancaire("BANK-1");
        service.deposit(AGENCY_ID, slip.getId(), request);
        verify(activity.events).save(org.mockito.ArgumentMatchers.argThat(event -> event.getAction() == ActivityAction.REMITTED
                && event.getTitle().equals("Bordereau remis a la banque") && event.getReferencesJson().contains("REG-1")));
    }

    @Test
    void newEntitiesDefaultToProvisionalButExistingStatusesAreNotForcedBack() {
        assertThat(new BordereauRemise().getStatut()).isEqualTo(StatutBordereauRemise.BROUILLON);
        for (TypeBordereauRemise type : TypeBordereauRemise.values()) {
            assertThat(BordereauRemise.builder().type(type).build().getStatut()).isEqualTo(StatutBordereauRemise.BROUILLON);
        }
        assertThat(BordereauRemise.builder().statut(StatutBordereauRemise.CLOTURE).build().getStatut())
                .isEqualTo(StatutBordereauRemise.CLOTURE);
    }

    private void assertProvisional(BordereauRemiseResponse created) {
        assertThat(created.getStatut()).isEqualTo(StatutBordereauRemise.BROUILLON);
        assertThat(created.getDateDepot()).isNull();
        assertThat(created.getReferenceBancaire()).isNull();
        assertThat(created.getOperationTresorerieId()).isNull();
        assertThat(created.getMontantTotal()).isEqualByComparingTo("100.00");
    }

    private CreerBordereauRemiseRequest request(TypeBordereauRemise type) {
        CreerBordereauRemiseRequest request = new CreerBordereauRemiseRequest();
        request.setType(type);
        request.setDateBordereau(DATE);
        request.setCompteDestinationId(2L);
        request.setReferenceBancaire("Not a validation instruction");
        if (type == TypeBordereauRemise.VERSEMENT_ESPECES) request.setMouvementEspecesIds(List.of(20L));
        else request.setInstrumentIds(List.of(10L));
        return request;
    }

    private InstrumentReglementClient prepareInstrument(TypeBordereauRemise type) {
        ReglementClient payment = ReglementClient.builder().agence(agency).numero("REG-1")
                .payeurNom("Client test").statut(StatutReglementClient.VALIDE).build();
        payment.setId(5L);
        InstrumentReglementClient instrument = InstrumentReglementClient.builder().agence(agency).reglement(payment)
                .mode(type == TypeBordereauRemise.CHEQUE ? ModeReglementClient.CHEQUE : ModeReglementClient.EFFET)
                .statut(StatutInstrumentReglement.EN_ATTENTE).montant(new BigDecimal("100.00")).build();
        instrument.setId(10L);
        when(instruments.findAllByAgenceIdAndIdInForUpdate(AGENCY_ID, List.of(10L))).thenReturn(List.of(instrument));
        return instrument;
    }

    private void prepareCash() {
        CompteTresorerie cash = CompteTresorerie.builder().agence(agency).libelle("Caisse")
                .typeCompte(TypeCompteTresorerie.CAISSE).natureCaisse(NatureCaisseTresorerie.INDIVIDUELLE)
                .soldeInitial(new BigDecimal("500.00")).build();
        cash.setId(3L);
        MouvementTresorerie movement = MouvementTresorerie.builder().agence(agency).compteTresorerie(cash)
                .sens(SensMouvementTresorerie.ENTREE).nature(NatureMouvementTresorerie.REGLEMENT_CLIENT)
                .dateOperation(DATE).montant(new BigDecimal("100.00")).build();
        movement.setId(20L);
        when(movements.findAllByAgenceIdAndIdInForUpdate(AGENCY_ID, List.of(20L))).thenReturn(List.of(movement));
    }
}
