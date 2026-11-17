package com.assurance.service;

import com.assurance.dto.request.CreerReglementClientRequest;
import com.assurance.entity.AffectationReglementClient;
import com.assurance.entity.Agence;
import com.assurance.entity.Banque;
import com.assurance.entity.CompteTresorerie;
import com.assurance.entity.InstrumentReglementClient;
import com.assurance.entity.MouvementTresorerie;
import com.assurance.entity.ReglementClient;
import com.assurance.enums.ModeReglementClient;
import com.assurance.enums.NatureMouvementTresorerie;
import com.assurance.enums.SensMouvementTresorerie;
import com.assurance.enums.StatutAffectationReglement;
import com.assurance.enums.StatutInstrumentReglement;
import com.assurance.enums.StatutReglementClient;
import com.assurance.enums.TypeCompteTresorerie;
import com.assurance.exception.BadRequestException;
import com.assurance.repository.InstrumentReglementClientRepository;
import com.assurance.repository.MouvementTresorerieRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ImmediateClientPaymentTest {

    @Mock
    private TresorerieService treasury;
    @Mock
    private InstrumentReglementClientRepository instruments;
    @Mock
    private MouvementTresorerieRepository movements;
    @Mock
    private BanqueService banks;
    @InjectMocks
    private ReglementClientService service;

    @ParameterizedTest
    @EnumSource(value = ModeReglementClient.class, names = {"ESPECES", "VIREMENT", "VERSEMENT_BANCAIRE"})
    void receivedMoneyConfirmsInstrumentAllocationsAndPostsTreasuryOnce(ModeReglementClient mode) {
        ReglementClient payment = payment();
        CompteTresorerie account = account(payment.getAgence());
        InstrumentReglementClient instrument = instrument(payment, account, mode, StatutInstrumentReglement.EN_ATTENTE);
        AffectationReglementClient allocation = AffectationReglementClient.builder()
                .instrument(instrument).montant(new BigDecimal("100.00"))
                .statut(StatutAffectationReglement.EN_ATTENTE).build();
        instrument.getAffectations().add(allocation);

        ReflectionTestUtils.invokeMethod(service, "confirmImmediateInstruments", payment);

        assertThat(instrument.getStatut()).isEqualTo(StatutInstrumentReglement.CONFIRME);
        assertThat(allocation.getStatut()).isEqualTo(StatutAffectationReglement.CONFIRMEE);
        verify(treasury).recordInstrumentEntry(instrument, account, payment.getDateReglement());
    }

    @ParameterizedTest
    @EnumSource(value = ModeReglementClient.class, names = {"CHEQUE", "EFFET"})
    void chequesAndEffectsRemainPendingWithoutPostingTreasury(ModeReglementClient mode) {
        ReglementClient payment = payment();
        InstrumentReglementClient instrument = instrument(payment, account(payment.getAgence()), mode,
                StatutInstrumentReglement.EN_ATTENTE);

        ReflectionTestUtils.invokeMethod(service, "confirmImmediateInstruments", payment);

        assertThat(instrument.getStatut()).isEqualTo(StatutInstrumentReglement.EN_ATTENTE);
        verifyNoInteractions(treasury);
    }

    @Test
    void bankTransferConstructionStillValidatesAccountAndOriginatingBank() {
        ReglementClient payment = payment();
        CompteTresorerie account = account(payment.getAgence());
        when(treasury.findAccount(7L, 3L)).thenReturn(account);
        when(banks.requireActive(7L, 2L)).thenReturn(new Banque());
        CreerReglementClientRequest.Instrument request = new CreerReglementClientRequest.Instrument();
        request.setMode(ModeReglementClient.VIREMENT);
        request.setMontant(new BigDecimal("100.00"));
        request.setCompteTresorerieId(3L);
        request.setBanqueEmettriceId(2L);

        InstrumentReglementClient deferred = ReflectionTestUtils.invokeMethod(service, "buildInstrument",
                payment.getAgence(), payment, request, true);
        InstrumentReglementClient replacement = ReflectionTestUtils.invokeMethod(service, "buildInstrument",
                payment.getAgence(), payment, request, false);

        assertThat(deferred.getStatut()).isEqualTo(StatutInstrumentReglement.EN_ATTENTE);
        assertThat(replacement.getStatut()).isEqualTo(StatutInstrumentReglement.CONFIRME);
        assertThat(replacement.getCompteTresorerie()).isSameAs(account);
        request.setCompteTresorerieId(null);
        assertThatThrownBy(() -> ReflectionTestUtils.invokeMethod(service, "buildInstrument",
                payment.getAgence(), payment, request, false)).isInstanceOf(BadRequestException.class);
    }

    @ParameterizedTest
    @EnumSource(value = ModeReglementClient.class, names = {"VIREMENT", "VERSEMENT_BANCAIRE"})
    void bankReconciliationReusesExistingConfirmedEntryWithoutPostingAgain(ModeReglementClient mode) {
        ReglementClient payment = payment();
        CompteTresorerie account = account(payment.getAgence());
        InstrumentReglementClient instrument = instrument(payment, account, mode, StatutInstrumentReglement.CONFIRME);
        MouvementTresorerie entry = entry(instrument, account);
        when(instruments.findByIdAndAgenceIdForUpdate(9L, 7L)).thenReturn(Optional.of(instrument));
        when(treasury.findAccount(7L, 3L)).thenReturn(account);
        when(movements.findFirstByAgenceIdAndInstrumentReglementIdAndNatureOrderByIdDesc(
                7L, 9L, NatureMouvementTresorerie.REGLEMENT_CLIENT)).thenReturn(Optional.of(entry));

        MouvementTresorerie result = service.confirmInstrumentFromBankStatement(7L, 9L, 3L, LocalDate.now(), null);

        assertThat(result).isSameAs(entry);
        assertThat(instrument.getDateStatut()).isEqualTo(payment.getDateReglement());
        verify(treasury, never()).recordInstrumentEntry(any(), any(), any());
        verify(treasury, never()).recordInstrumentEntry(any(), any(), any(), any());
        verify(instruments, never()).save(any());
    }

    @Test
    void confirmedTransferCannotBeReconciledToAnotherAccount() {
        ReglementClient payment = payment();
        InstrumentReglementClient instrument = instrument(payment, account(payment.getAgence()),
                ModeReglementClient.VIREMENT, StatutInstrumentReglement.CONFIRME);
        when(instruments.findByIdAndAgenceIdForUpdate(9L, 7L)).thenReturn(Optional.of(instrument));

        assertThatThrownBy(() -> service.confirmInstrumentFromBankStatement(7L, 9L, 4L, LocalDate.now(), null))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("autre compte");
        verifyNoInteractions(treasury, movements);
    }

    private ReglementClient payment() {
        Agence agency = new Agence();
        agency.setId(7L);
        return ReglementClient.builder().agence(agency).statut(StatutReglementClient.VALIDE)
                .sens(SensMouvementTresorerie.ENTREE).dateReglement(LocalDate.now().minusDays(1)).build();
    }

    private CompteTresorerie account(Agence agency) {
        CompteTresorerie account = CompteTresorerie.builder().agence(agency).typeCompte(TypeCompteTresorerie.BANQUE)
                .actif(true).build();
        account.setId(3L);
        return account;
    }

    private InstrumentReglementClient instrument(ReglementClient payment, CompteTresorerie account,
            ModeReglementClient mode, StatutInstrumentReglement status) {
        InstrumentReglementClient instrument = InstrumentReglementClient.builder().agence(payment.getAgence())
                .reglement(payment).compteTresorerie(account).mode(mode).statut(status)
                .dateStatut(payment.getDateReglement()).montant(new BigDecimal("100.00")).build();
        instrument.setId(9L);
        payment.getInstruments().add(instrument);
        return instrument;
    }

    private MouvementTresorerie entry(InstrumentReglementClient instrument, CompteTresorerie account) {
        MouvementTresorerie movement = MouvementTresorerie.builder().agence(instrument.getAgence())
                .instrumentReglement(instrument).compteTresorerie(account).montant(instrument.getMontant())
                .sens(SensMouvementTresorerie.ENTREE).nature(NatureMouvementTresorerie.REGLEMENT_CLIENT).build();
        movement.setId(15L);
        return movement;
    }
}
