package com.assurance.service;

import com.assurance.activity.BusinessActivityRecorder;
import com.assurance.dto.response.AdminUtilisateurResponse;
import com.assurance.entity.Agence;
import com.assurance.entity.CompteTresorerie;
import com.assurance.entity.Utilisateur;
import com.assurance.entity.AffectationCompteTresorerie;
import com.assurance.enums.NatureCaisseTresorerie;
import com.assurance.enums.StatutInstrumentReglement;
import com.assurance.enums.StatutReglementClient;
import com.assurance.enums.StatutSessionCaisse;
import com.assurance.enums.TypeCompteTresorerie;
import com.assurance.exception.BadRequestException;
import com.assurance.repository.AgenceRepository;
import com.assurance.repository.AffectationCompteTresorerieRepository;
import com.assurance.repository.CompteTresorerieRepository;
import com.assurance.repository.InstrumentReglementClientRepository;
import com.assurance.repository.MouvementTresorerieRepository;
import com.assurance.repository.SessionCaisseRepository;
import com.assurance.repository.UtilisateurRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PersonalCashAccountTest {

    @Mock
    private AgenceRepository agencies;
    @Mock
    private CompteTresorerieRepository accounts;
    @Mock
    private MouvementTresorerieRepository movements;
    @Mock
    private UtilisateurRepository users;
    @Mock
    private TresorerieAccessService access;
    @Mock
    private BanqueService banks;
    @Mock
    private BusinessActivityRecorder activity;
    @Mock
    private SessionCaisseRepository sessions;
    @Mock
    private InstrumentReglementClientRepository instruments;
    @Mock
    private AffectationCompteTresorerieRepository assignments;
    @InjectMocks
    private TresorerieService service;

    @Test
    void newUsersDefaultToNoPersonalCashAccount() {
        Utilisateur user = user(false);
        when(accounts.findByUtilisateurTitulaireIdAndTypeCompteAndNatureCaisse(
                10L, TypeCompteTresorerie.CAISSE, NatureCaisseTresorerie.INDIVIDUELLE))
                .thenReturn(List.of());

        assertThat(Utilisateur.builder().build().getCaisseIndividuelleActive()).isFalse();
        service.synchronizePersonalCashAccount(user);

        verify(accounts, never()).save(any());
        assertThat(AdminUtilisateurResponse.from(user).getCaisseIndividuelleActive()).isFalse();
    }

    @Test
    void optingInCreatesPersonalAccountForTheSameAgencyAndOwner() {
        Utilisateur user = user(true);
        when(accounts.findByUtilisateurTitulaireIdAndTypeCompteAndNatureCaisse(
                10L, TypeCompteTresorerie.CAISSE, NatureCaisseTresorerie.INDIVIDUELLE))
                .thenReturn(List.of());
        when(accounts.save(any())).thenAnswer(call -> {
            CompteTresorerie account = call.getArgument(0);
            account.setId(30L);
            return account;
        });

        service.synchronizePersonalCashAccount(user);

        ArgumentCaptor<CompteTresorerie> saved = ArgumentCaptor.forClass(CompteTresorerie.class);
        verify(accounts).save(saved.capture());
        assertThat(saved.getValue().getAgence()).isSameAs(user.getAgence());
        assertThat(saved.getValue().getUtilisateurTitulaire()).isSameAs(user);
        assertThat(saved.getValue().getNatureCaisse()).isEqualTo(NatureCaisseTresorerie.INDIVIDUELLE);
        assertThat(saved.getValue().getActif()).isTrue();
        assertThat(saved.getValue().getSoldeInitial()).isZero();
        verify(access).ensureCashOwnerAccess(saved.getValue());
    }

    @Test
    void optingOutKeepsTheExistingAccountAndRevokesItsActiveUsage() {
        Utilisateur user = user(false);
        CompteTresorerie account = account(user, true);
        existing(account);

        service.synchronizePersonalCashAccount(user);

        assertThat(account.getId()).isEqualTo(30L);
        assertThat(account.getActif()).isFalse();
        verify(accounts).save(account);
        verify(accounts, never()).delete(any());
        verify(access, atLeastOnce()).ensureCashOwnerAccess(account);
    }

    @Test
    void reEnablingReusesTheHistoricalAccountWithoutChangingOpeningBalance() {
        Utilisateur user = user(true);
        CompteTresorerie account = account(user, false);
        account.setSoldeInitial(new BigDecimal("125.00"));
        existing(account);

        service.synchronizePersonalCashAccount(user);

        verify(accounts).save(account);
        assertThat(account.getId()).isEqualTo(30L);
        assertThat(account.getActif()).isTrue();
        assertThat(account.getSoldeInitial()).isEqualByComparingTo("125.00");
    }

    @ParameterizedTest
    @ValueSource(strings = {"10.00", "-10.00"})
    void cannotDisableAnAccountWithANonZeroBalance(String balance) {
        Utilisateur user = user(false);
        CompteTresorerie account = account(user, true);
        existing(account);
        when(movements.balanceForAccount(30L)).thenReturn(new BigDecimal(balance));

        assertThatThrownBy(() -> service.synchronizePersonalCashAccount(user))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("solde");
        assertThat(account.getActif()).isTrue();
        verify(accounts, never()).save(any());
    }

    @Test
    void cannotDisableAnAccountWithAnOpenSession() {
        Utilisateur user = user(false);
        CompteTresorerie account = account(user, true);
        existing(account);
        when(sessions.existsByAgenceIdAndCompteTresorerieIdAndStatut(7L, 30L, StatutSessionCaisse.OUVERTE))
                .thenReturn(true);

        assertThatThrownBy(() -> service.synchronizePersonalCashAccount(user))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("session");
        assertThat(account.getActif()).isTrue();
    }

    @Test
    void cannotDisableAnAccountWithPendingCashPayments() {
        Utilisateur user = user(false);
        CompteTresorerie account = account(user, true);
        existing(account);
        when(instruments.existsByAgenceIdAndCompteTresorerieIdAndStatutAndReglementStatut(
                7L, 30L, StatutInstrumentReglement.EN_ATTENTE, StatutReglementClient.VALIDE))
                .thenReturn(true);

        assertThatThrownBy(() -> service.synchronizePersonalCashAccount(user))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("règlements en attente");
        assertThat(account.getActif()).isTrue();
    }

    @Test
    void disablingUsesOpeningBalancePlusRecordedMovements() {
        Utilisateur user = user(false);
        CompteTresorerie account = account(user, true);
        account.setSoldeInitial(new BigDecimal("125.00"));
        existing(account);
        when(movements.balanceForAccount(30L)).thenReturn(new BigDecimal("-125.00"));

        service.synchronizePersonalCashAccount(user);

        assertThat(account.getActif()).isFalse();
        assertThat(account.getSoldeInitial()).isEqualByComparingTo("125.00");
    }

    @Test
    void agencyTransferCannotAbandonTheFormerAgencyCashBalance() {
        Utilisateur user = user(true);
        CompteTresorerie account = account(user, true);
        Agence newAgency = new Agence();
        newAgency.setId(8L);
        user.setAgence(newAgency);
        existing(account);
        when(movements.balanceForAccount(30L)).thenReturn(new BigDecimal("25.00"));

        assertThatThrownBy(() -> service.synchronizePersonalCashAccount(user))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("solde");
        assertThat(account.getActif()).isTrue();
        assertThat(account.getAgence().getId()).isEqualTo(7L);
    }

    @Test
    void cashPaymentLookupRejectsUsersWithoutAnActivePersonalAccount() {
        when(access.currentUserId()).thenReturn(10L);
        when(accounts.findByAgenceIdAndUtilisateurTitulaireIdAndTypeCompteAndNatureCaisseAndActifTrue(
                7L, 10L, TypeCompteTresorerie.CAISSE, NatureCaisseTresorerie.INDIVIDUELLE))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.findCurrentUserCashAccount(7L))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("Aucune caisse");
    }

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void personalCashOwnerAccessFollowsTheSettingWithoutGrantingRolePermissions(boolean enabled) {
        Utilisateur user = user(enabled);
        CompteTresorerie account = account(user, true);
        when(assignments.findByCompteTresorerieIdAndUtilisateurId(30L, 10L)).thenReturn(Optional.empty());
        TresorerieAccessService accessService = new TresorerieAccessService(assignments, accounts, users, activity);

        accessService.ensureCashOwnerAccess(account);

        ArgumentCaptor<AffectationCompteTresorerie> saved = ArgumentCaptor.forClass(AffectationCompteTresorerie.class);
        verify(assignments).save(saved.capture());
        assertThat(saved.getValue().getActif()).isEqualTo(enabled);
        assertThat(user.getPermissions()).isEmpty();
    }

    private void existing(CompteTresorerie account) {
        when(accounts.findByUtilisateurTitulaireIdAndTypeCompteAndNatureCaisse(
                10L, TypeCompteTresorerie.CAISSE, NatureCaisseTresorerie.INDIVIDUELLE))
                .thenReturn(List.of(account));
        lenient().when(accounts.save(any())).thenAnswer(call -> call.getArgument(0));
    }

    private Utilisateur user(boolean enabled) {
        Agence agency = new Agence();
        agency.setId(7L);
        Utilisateur user = Utilisateur.builder().agence(agency).prenom("Anas").nom("Test")
                .actif(true).caisseIndividuelleActive(enabled).build();
        user.setId(10L);
        return user;
    }

    private CompteTresorerie account(Utilisateur user, boolean active) {
        CompteTresorerie account = CompteTresorerie.builder().agence(user.getAgence()).code("CAISSE-U000010")
                .libelle("Caisse - Anas Test").typeCompte(TypeCompteTresorerie.CAISSE)
                .natureCaisse(NatureCaisseTresorerie.INDIVIDUELLE).utilisateurTitulaire(user)
                .devise("MAD").soldeInitial(BigDecimal.ZERO).actif(active).build();
        account.setId(30L);
        return account;
    }
}
