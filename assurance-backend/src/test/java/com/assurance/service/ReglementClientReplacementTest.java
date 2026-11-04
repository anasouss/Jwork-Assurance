package com.assurance.service;

import com.assurance.dto.request.RemplacerInstrumentReglementRequest;
import com.assurance.entity.*;
import com.assurance.enums.*;
import com.assurance.exception.BadRequestException;
import com.assurance.repository.InstrumentReglementClientRepository;
import com.assurance.repository.LigneBordereauRemiseRepository;
import com.assurance.repository.ReglementClientRepository;
import com.assurance.repository.EcartReglementClientRepository;
import com.assurance.repository.MouvementRejetBancaireRepository;
import com.assurance.repository.UtilisateurRepository;
import com.assurance.repository.RejetBancaireRepository;
import com.assurance.security.TenantContext;
import com.assurance.dto.request.AjouterMouvementRejetRequest;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.dto.response.SuiviRejetBancaireResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ReglementClientReplacementTest {
    @Mock
    private InstrumentReglementClientRepository instrumentRepository;
    @Mock
    private LigneBordereauRemiseRepository remittanceLineRepository;
    @Mock
    private ReglementClientRepository reglementRepository;
    @Mock
    private TresorerieService tresorerieService;
    @Mock
    private BanqueService banqueService;
    @Mock
    private EcartReglementClientRepository ecartRepository;
    @Mock
    private RejetBancaireSuiviService rejetSuiviService;
    @Mock
    private UtilisateurRepository utilisateurs;
    @Mock
    private RejetBancaireRepository rejets;
    @InjectMocks
    private ReglementClientService service;

    @Test
    void repeatedSameDayRejectionsKeepDistinctReferencesAndExactRemittanceLinks() {
        var events = mock(MouvementRejetBancaireRepository.class);
        var followUp = new RejetBancaireSuiviService(instrumentRepository, remittanceLineRepository, events, utilisateurs, rejets);
        Agence agency = Agence.builder().build();
        agency.setId(7L);
        ReglementClient payment = ReglementClient.builder().agence(agency).statut(StatutReglementClient.VALIDE).build();
        payment.setId(12L);
        var instrument = followUpInstrument(payment, 24L, "6475.00", StatutInstrumentReglement.REJETE, null);
        LocalDate date = LocalDate.of(2026, 11, 4);
        instrument.setDateRejet(date);
        var firstSlip = BordereauRemise.builder().agence(agency).numero("BRC-5").dateDepot(date).build();
        firstSlip.setId(7L);
        var secondSlip = BordereauRemise.builder().agence(agency).numero("BRC-8").dateDepot(date).build();
        secondSlip.setId(12L);
        var firstLine = LigneBordereauRemise.builder().bordereau(firstSlip).instrument(instrument)
                .statut(StatutLigneBordereauRemise.REJETEE).dateTraitement(date).motifRejet("INSUFF").build();
        firstLine.setId(9L);
        var secondLine = LigneBordereauRemise.builder().bordereau(secondSlip).instrument(instrument)
                .statut(StatutLigneBordereauRemise.REJETEE).dateTraitement(date).motifRejet("INSUFF").build();
        secondLine.setId(13L);
        when(rejets.currentSequence(7L, 2026)).thenReturn(1L, 2L);
        when(rejets.saveAndFlush(any(RejetBancaire.class))).thenAnswer(invocation -> {
            RejetBancaire occurrence = invocation.getArgument(0);
            occurrence.setId(occurrence.getSequenceNumero());
            return occurrence;
        });
        var recorded = new java.util.ArrayList<MouvementRejetBancaire>();
        when(events.save(any(MouvementRejetBancaire.class))).thenAnswer(invocation -> {
            MouvementRejetBancaire event = invocation.getArgument(0);
            event.setId((long) recorded.size() + 1);
            recorded.add(event);
            return event;
        });
        followUp.enregistrerRejet(instrument, firstLine, date, "INSUFF");
        followUp.enregistrerRejet(instrument, secondLine, date, "INSUFF");
        assertThat(recorded).hasSize(2);
        assertThat(recorded).extracting(event -> event.getRejet().getNumero()).containsExactly("REJ26-0001", "REJ26-0002");
        assertThat(recorded).extracting(event -> event.getRejet().getLigneRemise()).containsExactly(firstLine, secondLine);
        verify(rejets, times(2)).incrementSequence(7L, 2026);
        when(instrumentRepository.findByIdAndAgenceId(24L, 7L)).thenReturn(Optional.of(instrument));
        when(remittanceLineRepository.findHistoryByAgenceIdAndInstrumentId(7L, 24L)).thenReturn(List.of(firstLine, secondLine));
        when(events.findByAgenceIdAndInstrumentIdOrderByDateOperationAscIdAsc(7L, 24L)).thenReturn(recorded);
        when(rejets.findByAgenceIdAndInstrumentIdOrderByIdAsc(7L, 24L))
                .thenReturn(recorded.stream().map(MouvementRejetBancaire::getRejet).toList());
        var rejectionEvents = followUp.detail(7L, 24L).mouvements().stream()
                .filter(event -> event.type() == TypeMouvementRejetBancaire.REJET).toList();
        assertThat(rejectionEvents).hasSize(2);
        assertThat(rejectionEvents).extracting(SuiviRejetBancaireResponse.Mouvement::numeroRejet)
                .containsExactly("REJ26-0001", "REJ26-0002");
    }

    @Test
    void rejectionDetailsCannotReadAnotherAgencyAndWrongSlipCannotAllocateReference() {
        var events = mock(MouvementRejetBancaireRepository.class);
        var followUp = new RejetBancaireSuiviService(instrumentRepository, remittanceLineRepository, events, utilisateurs, rejets);
        assertThatThrownBy(() -> followUp.detailRejet(8L, 1L)).isInstanceOf(ResourceNotFoundException.class);
        verify(rejets).findByIdAndAgenceId(1L, 8L);
        Agence agency = Agence.builder().build();
        agency.setId(7L);
        Agence other = Agence.builder().build();
        other.setId(8L);
        var payment = ReglementClient.builder().agence(agency).statut(StatutReglementClient.VALIDE).build();
        var instrument = followUpInstrument(payment, 24L, "100.00", StatutInstrumentReglement.REJETE, null);
        var line = LigneBordereauRemise.builder().instrument(instrument)
                .bordereau(BordereauRemise.builder().agence(other).build()).build();
        assertThatThrownBy(() -> followUp.enregistrerRejet(instrument, line, LocalDate.now(), "INSUFF"))
                .isInstanceOf(BadRequestException.class);
        verify(rejets, never()).incrementSequence(any(), anyInt());
        verify(events, never()).save(any());
    }

    @Test
    void rejectionOperatorUsesAgencyScopedNameSnapshotRatherThanLoginEmail() {
        var events = mock(MouvementRejetBancaireRepository.class);
        var followUp = new RejetBancaireSuiviService(instrumentRepository, remittanceLineRepository, events, utilisateurs, rejets);
        Agence agency = Agence.builder().build();
        agency.setId(7L);
        ReglementClient payment = ReglementClient.builder().agence(agency).statut(StatutReglementClient.VALIDE).build();
        var instrument = followUpInstrument(payment, 1L, "100.00", StatutInstrumentReglement.REJETE, null);
        when(utilisateurs.findFullNameByIdAndAgenceId(42L, 7L)).thenReturn(Optional.of("Mohammed Melymane"));
        TenantContext.setCurrentUser(42L);
        TenantContext.setCurrentUsername("operator@example.test");
        try {
            ReflectionTestUtils.invokeMethod(followUp, "enregistrer", instrument, instrument,
                    TypeMouvementRejetBancaire.REJET, LocalDate.now(), "Provision insuffisante");
            var captured = org.mockito.ArgumentCaptor.forClass(MouvementRejetBancaire.class);
            verify(events).save(captured.capture());
            assertThat(captured.getValue().getUtilisateurId()).isEqualTo(42L);
            assertThat(captured.getValue().getUtilisateurNom()).isEqualTo("Mohammed Melymane");
        } finally {
            TenantContext.clear();
        }
    }

    @Test
    void unavailableOperatorNameDoesNotFallBackToEmail() {
        var events = mock(MouvementRejetBancaireRepository.class);
        var followUp = new RejetBancaireSuiviService(instrumentRepository, remittanceLineRepository, events, utilisateurs, rejets);
        Agence agency = Agence.builder().build();
        agency.setId(7L);
        ReglementClient payment = ReglementClient.builder().agence(agency).statut(StatutReglementClient.VALIDE).build();
        var instrument = followUpInstrument(payment, 1L, "100.00", StatutInstrumentReglement.REJETE, null);
        when(utilisateurs.findFullNameByIdAndAgenceId(42L, 7L)).thenReturn(Optional.empty());
        TenantContext.setCurrentUser(42L);
        TenantContext.setCurrentUsername("operator@example.test");
        try {
            ReflectionTestUtils.invokeMethod(followUp, "enregistrer", instrument, instrument,
                    TypeMouvementRejetBancaire.REJET, LocalDate.now(), "Provision insuffisante");
            var captured = org.mockito.ArgumentCaptor.forClass(MouvementRejetBancaire.class);
            verify(events).save(captured.capture());
            assertThat(captured.getValue().getUtilisateurId()).isEqualTo(42L);
            assertThat(captured.getValue().getUtilisateurNom()).isNull();
        } finally {
            TenantContext.clear();
        }
    }

    @Test
    void historyIncludesLegacyRemittancesAndMergesRecordedEventsWithoutInventingOperators() {
        var events = mock(MouvementRejetBancaireRepository.class);
        var followUp = new RejetBancaireSuiviService(instrumentRepository, remittanceLineRepository, events, utilisateurs, rejets);
        Agence agency = Agence.builder().build();
        agency.setId(7L);
        ReglementClient payment = ReglementClient.builder().agence(agency).statut(StatutReglementClient.VALIDE).build();
        payment.setId(5L);
        var instrument = followUpInstrument(payment, 1L, "100.00", StatutInstrumentReglement.REMIS_EN_BANQUE, null);
        LocalDate returned = LocalDate.of(2026, 11, 1);
        instrument.setDateRejet(returned);
        instrument.setMotifRejet("Provision insuffisante");
        var first = BordereauRemise.builder().numero("BRC-5").dateDepot(returned).build();
        first.setId(5L);
        var second = BordereauRemise.builder().numero("BRC-6").dateDepot(returned.plusDays(1)).build();
        second.setId(6L);
        var rejectedLine = LigneBordereauRemise.builder().bordereau(first).instrument(instrument)
                .statut(StatutLigneBordereauRemise.REJETEE).dateTraitement(returned).motifRejet("Provision insuffisante").build();
        rejectedLine.setId(10L);
        var resubmitted = LigneBordereauRemise.builder().bordereau(second).instrument(instrument)
                .statut(StatutLigneBordereauRemise.REMISE).build();
        resubmitted.setId(11L);
        when(instrumentRepository.findByIdAndAgenceId(1L, 7L)).thenReturn(Optional.of(instrument));
        when(remittanceLineRepository.findHistoryByAgenceIdAndInstrumentId(7L, 1L)).thenReturn(List.of(rejectedLine, resubmitted));
        var legacy = followUp.detail(7L, 1L).mouvements();
        assertThat(legacy).extracting(SuiviRejetBancaireResponse.Mouvement::libelle)
                .containsExactly("Remise initiale en banque", "Rejet bancaire", "Nouvelle remise en banque");
        assertThat(legacy).allMatch(SuiviRejetBancaireResponse.Mouvement::historiqueExistant);
        assertThat(legacy).allMatch(event -> event.utilisateur() == null);
        MouvementRejetBancaire recorded = new MouvementRejetBancaire();
        recorded.setId(20L);
        recorded.setDateOperation(returned.plusDays(1));
        recorded.setType(TypeMouvementRejetBancaire.REMISE_EN_BANQUE);
        recorded.setStatutSuivi(StatutSuiviRejetBancaire.REPRESENTE);
        recorded.setInstrumentSource(instrument);
        recorded.setUtilisateurNom("Operator");
        when(events.findByAgenceIdAndInstrumentIdOrderByDateOperationAscIdAsc(7L, 1L)).thenReturn(List.of(recorded));
        var merged = followUp.detail(7L, 1L).mouvements();
        assertThat(merged).hasSize(3);
        assertThat(merged.get(2).utilisateur()).isEqualTo("Operator");
        assertThat(merged.get(2).historiqueExistant()).isFalse();
        assertThat(merged.get(2).numeroBordereau()).isEqualTo("BRC-6");
        verify(events, never()).save(any());
    }

    @Test
    void rejectionClientCardOnlyExposesIdentifiersMatchingTheClientType() {
        var followUp = new RejetBancaireSuiviService(instrumentRepository, remittanceLineRepository,
                mock(MouvementRejetBancaireRepository.class), utilisateurs, rejets);
        Client client = Client.builder().typeClient(TypeClient.PERSONNE_PHYSIQUE)
                .cin("CIN-001").passport("PASS-001").rc("RC-001").ice("ICE-001").iff("IF-001").build();
        SuiviRejetBancaireResponse.Client physical = ReflectionTestUtils.invokeMethod(followUp, "ficheClient", client);
        assertThat(physical).isNotNull();
        assertThat(physical.typeClient()).isEqualTo(TypeClient.PERSONNE_PHYSIQUE);
        assertThat(physical.cin()).isEqualTo("CIN-001");
        assertThat(physical.passport()).isEqualTo("PASS-001");
        assertThat(physical.rc()).isNull();
        assertThat(physical.ice()).isNull();
        assertThat(physical.iff()).isNull();
        client.setTypeClient(TypeClient.PERSONNE_MORALE);
        client.setRaisonSociale("Company");
        SuiviRejetBancaireResponse.Client company = ReflectionTestUtils.invokeMethod(followUp, "ficheClient", client);
        assertThat(company).isNotNull();
        assertThat(company.nom()).isEqualTo("Company");
        assertThat(company.rc()).isEqualTo("RC-001");
        assertThat(company.ice()).isEqualTo("ICE-001");
        assertThat(company.cin()).isNull();
        assertThat(company.passport()).isNull();
        client.setTypeClient(null);
        SuiviRejetBancaireResponse.Client unknown = ReflectionTestUtils.invokeMethod(followUp, "ficheClient", client);
        assertThat(unknown).isNotNull();
        assertThat(unknown.cin()).isNull();
        assertThat(unknown.rc()).isNull();
    }

    @Test
    void rejectionIsSettledOnlyAfterEveryCounterValueIsConfirmedIncludingReplacementChains() {
        var followUp = new RejetBancaireSuiviService(instrumentRepository, remittanceLineRepository,
                mock(MouvementRejetBancaireRepository.class), utilisateurs, rejets);
        Agence agency = Agence.builder().build();
        agency.setId(7L);
        ReglementClient payment = ReglementClient.builder().agence(agency).statut(StatutReglementClient.VALIDE).build();
        payment.setId(5L);
        InstrumentReglementClient rejected = followUpInstrument(payment, 1L, "100.00", StatutInstrumentReglement.REMPLACE, null);
        followUpInstrument(payment, 2L, "30.00", StatutInstrumentReglement.CONFIRME, rejected);
        InstrumentReglementClient second = followUpInstrument(payment, 3L, "70.00", StatutInstrumentReglement.EN_ATTENTE, rejected);
        assertThat(followUp.statut(rejected)).isEqualTo(StatutSuiviRejetBancaire.INSTANCE);
        rejected.setSuiviRejet(StatutSuiviRejetBancaire.CONTENTIEUX);
        assertThat(followUp.statut(rejected)).isEqualTo(StatutSuiviRejetBancaire.CONTENTIEUX);
        second.setStatut(StatutInstrumentReglement.REMPLACE);
        followUpInstrument(payment, 4L, "40.00", StatutInstrumentReglement.CONFIRME, second);
        InstrumentReglementClient last = followUpInstrument(payment, 5L, "30.00", StatutInstrumentReglement.EN_ATTENTE, second);
        assertThat(followUp.statut(rejected)).isNotEqualTo(StatutSuiviRejetBancaire.REGLE_CV);
        last.setStatut(StatutInstrumentReglement.CONFIRME);
        assertThat(followUp.statut(rejected)).isEqualTo(StatutSuiviRejetBancaire.REGLE_CV);
        last.setStatut(StatutInstrumentReglement.REJETE);
        assertThat(followUp.statut(rejected)).isNotEqualTo(StatutSuiviRejetBancaire.REGLE_CV);
        verifyNoInteractions(tresorerieService);
    }

    @Test
    void preparingAResubmissionDoesNotMeanItHasBeenPresentedToTheBank() {
        var followUp = new RejetBancaireSuiviService(instrumentRepository, remittanceLineRepository,
                mock(MouvementRejetBancaireRepository.class), utilisateurs, rejets);
        Agence agency = Agence.builder().build();
        agency.setId(7L);
        ReglementClient payment = ReglementClient.builder().agence(agency).statut(StatutReglementClient.VALIDE).build();
        var instrument = followUpInstrument(payment, 1L, "100.00", StatutInstrumentReglement.EN_ATTENTE, null);
        assertThat(followUp.statut(instrument)).isEqualTo(StatutSuiviRejetBancaire.INSTANCE);
        instrument.setStatut(StatutInstrumentReglement.REMIS_EN_BANQUE);
        assertThat(followUp.statut(instrument)).isEqualTo(StatutSuiviRejetBancaire.REPRESENTE);
    }

    @Test
    void manualFollowUpCannotInventSettlementOrReadAnotherAgency() {
        var events = mock(MouvementRejetBancaireRepository.class);
        var followUp = new RejetBancaireSuiviService(instrumentRepository, remittanceLineRepository, events, utilisateurs, rejets);
        Agence agency = Agence.builder().build();
        agency.setId(7L);
        ReglementClient payment = ReglementClient.builder().agence(agency).statut(StatutReglementClient.VALIDE).build();
        payment.setId(5L);
        var instrument = followUpInstrument(payment, 1L, "100.00", StatutInstrumentReglement.REJETE, null);
        instrument.setDateRejet(LocalDate.now().minusDays(1));
        when(instrumentRepository.findByIdAndAgenceIdForUpdate(1L, 7L)).thenReturn(Optional.of(instrument));
        when(instrumentRepository.findByIdAndAgenceId(1L, 7L)).thenReturn(Optional.of(instrument));
        AjouterMouvementRejetRequest request = new AjouterMouvementRejetRequest();
        request.setStatut(StatutSuiviRejetBancaire.REGLE_CV);
        request.setDateOperation(LocalDate.now());
        request.setMotif("Attempted settlement");
        assertThatThrownBy(() -> followUp.ajouter(7L, 1L, request)).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> followUp.detail(8L, 1L)).isInstanceOf(ResourceNotFoundException.class);
        verify(events, never()).save(any());
    }

    private InstrumentReglementClient followUpInstrument(ReglementClient payment, Long id, String amount,
                                                         StatutInstrumentReglement status, InstrumentReglementClient replaced) {
        var instrument = InstrumentReglementClient.builder().agence(payment.getAgence()).reglement(payment)
                .mode(ModeReglementClient.CHEQUE).montant(new BigDecimal(amount)).statut(status)
                .instrumentRemplace(replaced).build();
        instrument.setId(id);
        payment.getInstruments().add(instrument);
        return instrument;
    }

    @Test
    void splitsAcrossTargetsAndPreservesUnallocatedCreditAndPayerSnapshots() {
        ElementFacturable element = ElementFacturable.builder().build();
        Client client = Client.builder().build();
        DocumentClient document = DocumentClient.builder().build();
        var firstSource = AffectationReglementClient.builder().elementFacturable(element).clientPayeur(client)
                .payeurNomSnapshot("Client snapshot").montant(new BigDecimal("60.00")).build();
        var secondSource = AffectationReglementClient.builder().documentClient(document)
                .payeurNomSnapshot("Invoice snapshot").montant(new BigDecimal("20.00")).build();
        var cash = replacement("30.00", StatutInstrumentReglement.CONFIRME);
        var cheque = replacement("70.00", StatutInstrumentReglement.EN_ATTENTE);

        split(List.of(firstSource, secondSource), List.of(cash, cheque));

        assertThat(cash.getAffectations()).singleElement().satisfies(allocation -> {
            assertThat(allocation.getMontant()).isEqualByComparingTo("30.00");
            assertThat(allocation.getElementFacturable()).isSameAs(element);
            assertThat(allocation.getClientPayeur()).isSameAs(client);
            assertThat(allocation.getPayeurNomSnapshot()).isEqualTo("Client snapshot");
            assertThat(allocation.getStatut()).isEqualTo(StatutAffectationReglement.CONFIRMEE);
        });
        assertThat(cheque.getAffectations()).hasSize(2);
        assertThat(cheque.getAffectations().get(0).getMontant()).isEqualByComparingTo("30.00");
        assertThat(cheque.getAffectations().get(1).getMontant()).isEqualByComparingTo("20.00");
        assertThat(cheque.getAffectations().get(1).getDocumentClient()).isSameAs(document);
        assertThat(cheque.getAffectations()).allMatch(a -> a.getStatut() == StatutAffectationReglement.EN_ATTENTE);
        assertThat(firstSource.getMontant()).isEqualByComparingTo("60.00");
        assertThat(secondSource.getMontant()).isEqualByComparingTo("20.00");
    }

    @Test
    void preservesEveryCentWhenALineCrossesAllocationBoundaries() {
        var a = AffectationReglementClient.builder().montant(new BigDecimal("0.01")).build();
        var b = AffectationReglementClient.builder().montant(new BigDecimal("0.02")).build();
        var first = replacement("0.02", StatutInstrumentReglement.EN_ATTENTE);
        var second = replacement("0.01", StatutInstrumentReglement.EN_ATTENTE);
        split(List.of(a, b), List.of(first, second));
        assertThat(first.getAffectations()).extracting(AffectationReglementClient::getMontant)
                .containsExactly(new BigDecimal("0.01"), new BigDecimal("0.01"));
        assertThat(second.getAffectations()).singleElement()
                .extracting(AffectationReglementClient::getMontant).isEqualTo(new BigDecimal("0.01"));
    }

    @Test
    void doesNotCountCancelledDirectAllocationsThatWereTransferredToAnInvoiceTwice() {
        var original = InstrumentReglementClient.builder().build();
        var element = ElementFacturable.builder().build();
        element.setId(20L);
        var document = DocumentClient.builder().build();
        document.getLignes().add(LigneDocumentClient.builder().elementFacturable(element).build());
        var direct = AffectationReglementClient.builder().elementFacturable(element)
                .montant(new BigDecimal("100.00")).statut(StatutAffectationReglement.ANNULEE).build();
        direct.setId(1L);
        var invoice = AffectationReglementClient.builder().documentClient(document)
                .montant(new BigDecimal("100.00")).statut(StatutAffectationReglement.ANNULEE).build();
        invoice.setId(2L);
        original.getAffectations().addAll(List.of(direct, invoice));
        List<AffectationReglementClient> sources = ReflectionTestUtils.invokeMethod(
                service, "replacementAllocationSources", original, false);
        assertThat(sources).containsExactly(invoice);
    }

    @Test
    void replacesOneChequeWithSeveralChequesAndEffectsKeepingTheOriginalLink() {
        var original = original();
        bank();
        save();
        service.replaceInstrument(7L, 9L, request(row(ModeReglementClient.CHEQUE, "40.00", "CH-NEW"),
                row(ModeReglementClient.EFFET, "60.00", "EF-NEW")));
        assertThat(original.getStatut()).isEqualTo(StatutInstrumentReglement.REMPLACE);
        assertThat(original.getDateRejet()).isEqualTo(LocalDate.now().minusDays(2));
        assertThat(original.getReglement().getInstruments()).hasSize(3);
        var replacements = original.getReglement().getInstruments().subList(1, 3);
        assertThat(replacements).allMatch(i -> i.getInstrumentRemplace() == original);
        assertThat(replacements).extracting(InstrumentReglementClient::getMontant)
                .containsExactly(new BigDecimal("40.00"), new BigDecimal("60.00"));
        assertThat(original.getReglement().getMontantTotal()).isEqualByComparingTo("100.00");
        verifyNoInteractions(tresorerieService);
    }

    @Test
    void confirmsAndPostsOnlyImmediateReplacementInstruments() {
        var original = original();
        bank();
        save();
        var account = CompteTresorerie.builder().agence(original.getAgence()).typeCompte(TypeCompteTresorerie.CAISSE).build();
        when(tresorerieService.findCurrentUserCashAccount(7L)).thenReturn(account);
        service.replaceInstrument(7L, 9L, request(row(ModeReglementClient.ESPECES, "25.00", null),
                row(ModeReglementClient.CHEQUE, "75.00", "CH-NEW")));
        var cash = original.getReglement().getInstruments().get(1);
        assertThat(cash.getStatut()).isEqualTo(StatutInstrumentReglement.CONFIRME);
        verify(tresorerieService).recordInstrumentEntry(cash, account, LocalDate.now());
        verify(tresorerieService, times(1)).recordInstrumentEntry(any(), any(), any());
    }

    @Test
    void invalidLastRowDoesNotMarkTheOriginalReplacedOrPersistAnyReplacement() {
        var original = original();
        bank();
        assertThatThrownBy(() -> service.replaceInstrument(7L, 9L, request(
                row(ModeReglementClient.CHEQUE, "40.00", "CH-NEW"),
                row(ModeReglementClient.EFFET, "60.00", null))))
                .isInstanceOf(BadRequestException.class);
        assertThat(original.getStatut()).isEqualTo(StatutInstrumentReglement.REJETE);
        assertThat(original.getReglement().getInstruments()).containsExactly(original);
        verifyNoInteractions(reglementRepository, tresorerieService);
    }

    @Test
    void rejectsWrongTotalsAndDuplicateReferencesBeforePersistence() {
        var original = original();
        assertThatThrownBy(() -> service.replaceInstrument(7L, 9L,
                request(row(ModeReglementClient.CHEQUE, "99.99", "CH-NEW"))))
                .isInstanceOf(BadRequestException.class);
        bank();
        assertThatThrownBy(() -> service.replaceInstrument(7L, 9L, request(
                row(ModeReglementClient.CHEQUE, "40.00", "CH-NEW"),
                row(ModeReglementClient.CHEQUE, "60.00", "ch-new"))))
                .isInstanceOf(BadRequestException.class);
        assertThat(original.getStatut()).isEqualTo(StatutInstrumentReglement.REJETE);
        verifyNoInteractions(reglementRepository, tresorerieService);
    }

    @Test
    void retainsCompatibilityWithSingleInstrumentRequests() {
        var original = original();
        bank();
        save();
        var request = new RemplacerInstrumentReglementRequest();
        request.setMode(ModeReglementClient.CHEQUE);
        request.setMontant(new BigDecimal("100.00"));
        request.setDateInstrument(LocalDate.now());
        request.setDateEcheance(LocalDate.now().plusMonths(1));
        request.setBanqueEmettriceId(1L);
        request.setReferenceInstrument("NEW");
        request.setMotif("Replacement");
        service.replaceInstrument(7L, 9L, request);
        assertThat(original.getReglement().getInstruments()).hasSize(2);
    }

    @Test
    void rejectsEmptyBatchAndSubCentAmounts() {
        original();
        assertThatThrownBy(() -> service.replaceInstrument(7L, 9L, request()))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.replaceInstrument(7L, 9L,
                request(row(ModeReglementClient.CHEQUE, "100.001", "NEW"))))
                .isInstanceOf(BadRequestException.class);
        verifyNoInteractions(reglementRepository, tresorerieService);
    }

    private void split(List<AffectationReglementClient> sources, List<InstrumentReglementClient> replacements) {
        ReflectionTestUtils.invokeMethod(service, "distributeReplacementAllocations", sources, replacements);
    }

    private InstrumentReglementClient replacement(String amount, StatutInstrumentReglement status) {
        return InstrumentReglementClient.builder().montant(new BigDecimal(amount)).statut(status).build();
    }

    private InstrumentReglementClient original() {
        Agence agency = Agence.builder().build();
        agency.setId(7L);
        Utilisateur actor = Utilisateur.builder().prenom("Test").nom("Operator").build();
        var payment = ReglementClient.builder().agence(agency).creePar(actor).dateReglement(LocalDate.now().minusDays(5))
                .montantTotal(new BigDecimal("100.00")).statut(StatutReglementClient.VALIDE).build();
        payment.setId(8L);
        var original = InstrumentReglementClient.builder().agence(agency).reglement(payment).mode(ModeReglementClient.CHEQUE)
                .statut(StatutInstrumentReglement.REJETE).montant(new BigDecimal("100.00"))
                .dateStatut(LocalDate.now().minusDays(2)).dateRejet(LocalDate.now().minusDays(2)).build();
        original.setId(9L);
        payment.getInstruments().add(original);
        when(instrumentRepository.findByIdAndAgenceIdForUpdate(9L, 7L)).thenReturn(Optional.of(original));
        return original;
    }

    private void bank() {
        when(banqueService.requireActive(7L, 1L)).thenReturn(Banque.builder().libelle("Bank").build());
    }

    private void save() {
        when(reglementRepository.saveAndFlush(any())).thenAnswer(invocation -> {
            ReglementClient payment = invocation.getArgument(0);
            long id = 20;
            for (var instrument : payment.getInstruments()) if (instrument.getId() == null) instrument.setId(id++);
            return payment;
        });
    }

    private RemplacerInstrumentReglementRequest request(RemplacerInstrumentReglementRequest.Instrument... rows) {
        var request = new RemplacerInstrumentReglementRequest();
        request.setDateRemplacement(LocalDate.now());
        request.setMotif("Replacement");
        request.setInstruments(List.of(rows));
        return request;
    }

    private RemplacerInstrumentReglementRequest.Instrument row(ModeReglementClient mode, String amount, String reference) {
        var row = new RemplacerInstrumentReglementRequest.Instrument();
        row.setMode(mode);
        row.setMontant(new BigDecimal(amount));
        row.setReferenceInstrument(reference);
        row.setBanqueEmettriceId(1L);
        row.setDateEcheance(LocalDate.now().plusMonths(1));
        return row;
    }
}
