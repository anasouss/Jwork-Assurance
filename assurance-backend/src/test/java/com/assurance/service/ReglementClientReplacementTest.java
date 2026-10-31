package com.assurance.service;

import com.assurance.dto.request.RemplacerInstrumentReglementRequest;
import com.assurance.entity.*;
import com.assurance.enums.*;
import com.assurance.exception.BadRequestException;
import com.assurance.repository.InstrumentReglementClientRepository;
import com.assurance.repository.LigneBordereauRemiseRepository;
import com.assurance.repository.ReglementClientRepository;
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
    @InjectMocks
    private ReglementClientService service;

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
