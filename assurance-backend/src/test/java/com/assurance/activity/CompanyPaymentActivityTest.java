package com.assurance.activity;

import com.assurance.dto.request.ChangerStatutInstrumentCompagnieRequest;
import com.assurance.entity.Agence;
import com.assurance.entity.CompagnieAssurance;
import com.assurance.entity.CompteTresorerie;
import com.assurance.entity.InstrumentReglementCompagnie;
import com.assurance.entity.MouvementTresorerie;
import com.assurance.entity.ReglementCompagnie;
import com.assurance.entity.TiersCompagnie;
import com.assurance.entity.Utilisateur;
import com.assurance.enums.ModeReglementCompagnie;
import com.assurance.enums.SensMouvementTresorerie;
import com.assurance.enums.StatutInstrumentReglement;
import com.assurance.enums.TypeCompteTresorerie;
import com.assurance.enums.TypeTiersCompagnie;
import com.assurance.exception.BadRequestException;
import com.assurance.repository.AffectationReglementCompagnieRepository;
import com.assurance.repository.AgenceRepository;
import com.assurance.repository.BordereauCompagnieRepository;
import com.assurance.repository.InstrumentReglementCompagnieRepository;
import com.assurance.repository.ReglementCompagnieRepository;
import com.assurance.repository.SequenceReglementCompagnieRepository;
import com.assurance.repository.UtilisateurRepository;
import com.assurance.service.ReglementCompagnieService;
import com.assurance.service.TiersCompagnieService;
import com.assurance.service.TresorerieService;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class CompanyPaymentActivityTest {
    private final ActivityRecorderFixture activity = new ActivityRecorderFixture();
    private final InstrumentReglementCompagnieRepository instruments = mock(InstrumentReglementCompagnieRepository.class);
    private final TresorerieService treasury = mock(TresorerieService.class);
    private final ReglementCompagnieService service = new ReglementCompagnieService(mock(ReglementCompagnieRepository.class), instruments,
            mock(AffectationReglementCompagnieRepository.class), mock(BordereauCompagnieRepository.class),
            mock(SequenceReglementCompagnieRepository.class), mock(AgenceRepository.class), mock(TiersCompagnieService.class),
            mock(UtilisateurRepository.class), treasury, activity.recorder);

    @Test
    void paymentRegistrationDoesNotClaimPendingBankInstrumentHasBeenPaid() {
        var instrument = instrument();
        var snapshot = CompanyPaymentActivity.snapshot(instrument.getReglement());
        assertThat(snapshot).containsEntry("Statut", "Enregistre").containsEntry("Moyen 1 - Statut", "En attente");
        assertThat(CompanyPaymentActivity.reference(instrument).type()).isEqualTo(ActivityRecordType.INSTRUMENT_REGLEMENT_COMPAGNIE);
    }

    @Test
    void confirmationGroupsBankPostingUnderCompanyInstrumentAction() {
        var instrument = instrument();
        when(instruments.lockByIdAndAgenceId(3L, 7L)).thenReturn(Optional.of(instrument));
        when(treasury.recordCompanyInstrumentExit(eq(instrument), any(), any())).thenAnswer(call -> {
            var movement = MouvementTresorerie.builder().agence(instrument.getAgence())
                    .instrumentReglementCompagnie(instrument).compteTresorerie(instrument.getCompteTresorerie())
                    .libelle("Reglement compagnie RGC-001").montant(instrument.getMontant()).sens(SensMouvementTresorerie.SORTIE).build();
            movement.setId(10L);
            activity.recorder.record(TreasuryActivity.movementCommand(movement, "Decaissement comptabilise", "TREASURY_COMPANY_PAYMENT"));
            return movement;
        });
        var request = new ChangerStatutInstrumentCompagnieRequest();
        request.setStatut(StatutInstrumentReglement.CONFIRME);
        request.setDateOperation(LocalDate.of(2026, 11, 5));
        service.changeInstrumentStatus(7L, 3L, request);
        verify(activity.events).save(argThat(event -> event.getModule() == ActivityModule.COMPTABILITE_COMPAGNIE
                && event.getSubjectType() == ActivityRecordType.INSTRUMENT_REGLEMENT_COMPAGNIE
                && event.getAction() == ActivityAction.CONFIRMED
                && event.getReferencesJson().contains("MOUVEMENT_TRESORERIE")
                && event.getChangesJson().contains("En attente") && event.getChangesJson().contains("Confirme")));
    }

    @Test
    void failedBankPostingDoesNotRecordSuccessfulConfirmation() {
        var instrument = instrument();
        when(instruments.lockByIdAndAgenceId(3L, 7L)).thenReturn(Optional.of(instrument));
        when(treasury.recordCompanyInstrumentExit(eq(instrument), any(), any())).thenThrow(new BadRequestException("Echec bancaire"));
        var request = new ChangerStatutInstrumentCompagnieRequest();
        request.setStatut(StatutInstrumentReglement.CONFIRME);
        assertThatThrownBy(() -> service.changeInstrumentStatus(7L, 3L, request)).isInstanceOf(BadRequestException.class);
        verifyNoInteractions(activity.events);
    }

    private InstrumentReglementCompagnie instrument() {
        var agency = Agence.builder().nom("Agence test").build();
        agency.setId(7L);
        var company = CompagnieAssurance.builder().nom("MATU").build();
        company.setId(4L);
        var tier = TiersCompagnie.builder().type(TypeTiersCompagnie.ASSURANCE).compagnieAssurance(company).build();
        tier.setId(8L);
        var payment = ReglementCompagnie.builder().agence(agency).numero("RGC-001").tiersCompagnie(tier)
                .creePar(Utilisateur.builder().prenom("Admin").nom("Test").build()).montantTotal(new BigDecimal("100.00")).build();
        payment.setId(1L);
        var bank = CompteTresorerie.builder().agence(agency).code("BANQUE").libelle("Banque principale")
                .typeCompte(TypeCompteTresorerie.BANQUE).actif(true).build();
        bank.setId(2L);
        var instrument = InstrumentReglementCompagnie.builder().agence(agency).reglement(payment).mode(ModeReglementCompagnie.VIREMENT)
                .compteTresorerie(bank).montant(new BigDecimal("100.00")).statut(StatutInstrumentReglement.EN_ATTENTE).build();
        instrument.setId(3L);
        payment.getInstruments().add(instrument);
        return instrument;
    }
}
