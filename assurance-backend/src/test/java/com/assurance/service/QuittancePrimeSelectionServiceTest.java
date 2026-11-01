package com.assurance.service;

import com.assurance.entity.Agence;
import com.assurance.entity.QuittancePrimeSelection;
import com.assurance.entity.ReglementClient;
import com.assurance.enums.StatutReglementClient;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.QuittancePrimeSelectionRepository;
import com.assurance.repository.ReglementClientRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.annotation.JsonInclude;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anySet;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;

class QuittancePrimeSelectionServiceTest {
    @TempDir
    Path directory;
    private final ReglementClientRepository payments = mock(ReglementClientRepository.class);
    private final QuittancePrimeSelectionRepository receipts = mock(QuittancePrimeSelectionRepository.class);
    private final QuittancePrimePdfService renderer = mock(QuittancePrimePdfService.class);
    private final StorageLayoutService storage = mock(StorageLayoutService.class);
    private final QuittancePrimeSelectionService service = new QuittancePrimeSelectionService(
            payments, receipts, renderer, storage, new ObjectMapper());

    @AfterEach
    void clearSynchronization() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    void fullPaymentArchiveKeepsAnExplicitNullSelectionEvenWhenNullFieldsAreNormallyOmitted() throws Exception {
        ObjectMapper mapper = new ObjectMapper().setSerializationInclusion(JsonInclude.Include.NON_NULL);
        var archive = new QuittancePrimeSelectionService.Archive("all", "2026000009", null, null);
        assertThat(mapper.writeValueAsString(archive)).contains("\"policyKeys\":null");
    }

    @Test
    void issuesDistinctNumericArchivesAndReusesTheSameSelectionRegardlessOfOrder() {
        ReglementClient payment = prepare();
        Map<String, QuittancePrimeSelection> issued = new HashMap<>();
        AtomicLong sequence = new AtomicLong();
        when(receipts.findByAgenceIdAndReglementIdAndSelectionHash(eq(7L), eq(9L), anyString()))
                .thenAnswer(call -> Optional.ofNullable(issued.get(call.getArgument(2))));
        when(receipts.saveAndFlush(any())).thenAnswer(call -> {
            QuittancePrimeSelection receipt = call.getArgument(0);
            if (receipt.getId() == null) receipt.setId(sequence.incrementAndGet());
            issued.put(receipt.getSelectionHash(), receipt);
            return receipt;
        });
        var first = service.issue(7L, 9L, List.of("C:2", "C:1"));
        var repeated = service.issue(7L, 9L, List.of("C:1", "C:2"));
        var different = service.issue(7L, 9L, List.of("C:1"));
        assertThat(first.reference()).matches("[0-9]+");
        assertThat(repeated.reference()).isEqualTo(first.reference());
        assertThat(repeated.pdf()).containsExactly(first.pdf());
        assertThat(different.reference()).isNotEqualTo(first.reference());
        assertThat(payment.getQuittancePrimeNumero()).isNull();
        verify(renderer).render(eq(payment), eq(first.reference()), any(), eq(Set.of("C:1", "C:2")));
        assertThat(issued).hasSize(2);
    }

    @Test
    void rejectsEmptyUnknownAndCrossAgencySelectionsBeforeIssuance() {
        prepare();
        assertThatThrownBy(() -> service.issue(7L, 9L, List.of())).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.issue(7L, 9L, List.of("C:999"))).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.issue(8L, 9L, List.of("C:1"))).isInstanceOf(ResourceNotFoundException.class);
        verify(receipts, never()).saveAndFlush(any());
        verify(renderer, never()).render(any(), anyString(), any(), anySet());
    }

    @Test
    void cancelledPaymentsAndForeignReceiptIdsCannotBeRead() {
        ReglementClient payment = prepare();
        assertThatThrownBy(() -> service.read(7L, 9L, 100L)).isInstanceOf(ResourceNotFoundException.class);
        payment.setStatut(StatutReglementClient.ANNULE);
        assertThatThrownBy(() -> service.issue(7L, 9L, List.of("C:1"))).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.read(7L, 9L, 100L)).isInstanceOf(BadRequestException.class);
    }

    @Test
    void refusesIneligiblePoliciesBeforeCreatingAnArchive() {
        ReglementClient payment = prepare();
        when(renderer.policies(payment)).thenReturn(List.of(
                new QuittancePrimePdfService.PolicyOption("C:1", List.of("P1"), new BigDecimal("50.00"), false, List.of())));
        assertThatThrownBy(() -> service.issue(7L, 9L, List.of("C:1"))).isInstanceOf(BadRequestException.class);
        verify(receipts, never()).saveAndFlush(any());
        verify(renderer, never()).render(any(), anyString(), any(), anySet());
    }

    @Test
    void missingArchiveNeverRegeneratesFromLiveFinancialData() throws Exception {
        prepare();
        QuittancePrimeSelection receipt = new QuittancePrimeSelection();
        receipt.setNumero("920260000000001");
        receipt.setCheminStockage("7/9/missing.pdf");
        when(receipts.findByIdAndAgenceIdAndReglementId(1L, 7L, 9L)).thenReturn(Optional.of(receipt));
        assertThatThrownBy(() -> service.read(7L, 9L, 1L)).isInstanceOf(BadRequestException.class);
        verify(renderer, never()).render(any(), anyString(), any(), anySet());
        assertThat(Files.exists(directory.resolve("7/9/missing.pdf"))).isFalse();
    }

    @Test
    void deletesOnlyTheSelectedArchiveAndItsFile() throws Exception {
        ReglementClient payment = prepare();
        payment.setMontantTotal(new BigDecimal("125.00"));
        payment.setNotes("Unchanged payment");
        QuittancePrimeSelection receipt = archive(payment, "7/9/remove.pdf");
        Path unrelated = directory.resolve("other.pdf");
        Files.write(unrelated, new byte[]{9});
        service.delete(7L, 9L, receipt.getId());
        verify(receipts).delete(receipt);
        verify(payments, never()).delete(any());
        verify(payments, never()).saveAndFlush(any());
        assertThat(Files.exists(directory.resolve(receipt.getCheminStockage()))).isFalse();
        assertThat(Files.exists(unrelated)).isTrue();
        assertThat(payment.getMontantTotal()).isEqualByComparingTo("125.00");
        assertThat(payment.getNotes()).isEqualTo("Unchanged payment");
        assertThat(payment.getStatut()).isEqualTo(StatutReglementClient.VALIDE);
    }

    @Test
    void deletesLegacyArchiveFieldsWithoutChangingThePayment() throws Exception {
        ReglementClient payment = prepare();
        QuittancePrimeSelection file = archive(payment, "7/9/legacy.pdf");
        payment.setQuittancePrimeNumero("2026000009");
        payment.setQuittancePrimeDateEmission(java.time.LocalDate.now());
        payment.setQuittancePrimeCheminStockage(file.getCheminStockage());
        payment.setMontantTotal(new BigDecimal("125.00"));
        service.delete(7L, 9L, null);
        assertThat(payment.getQuittancePrimeNumero()).isNull();
        assertThat(payment.getQuittancePrimeDateEmission()).isNull();
        assertThat(payment.getQuittancePrimeCheminStockage()).isNull();
        assertThat(payment.getMontantTotal()).isEqualByComparingTo("125.00");
        assertThat(payment.getStatut()).isEqualTo(StatutReglementClient.VALIDE);
        assertThat(Files.exists(directory.resolve(file.getCheminStockage()))).isFalse();
        verify(receipts, never()).delete(any());
        verify(payments).saveAndFlush(payment);
    }

    @Test
    void rejectsForeignAgencyReceiptAndForeignPaymentFileBeforeDeletingAnything() throws Exception {
        ReglementClient payment = prepare();
        assertThatThrownBy(() -> service.delete(8L, 9L, 1L)).isInstanceOf(ResourceNotFoundException.class);
        assertThatThrownBy(() -> service.delete(7L, 9L, 99L)).isInstanceOf(ResourceNotFoundException.class);
        archive(payment, "7/10/another-payment.pdf");
        assertThatThrownBy(() -> service.delete(7L, 9L, 1L)).isInstanceOf(BadRequestException.class);
        assertThat(Files.exists(directory.resolve("7/10/another-payment.pdf"))).isTrue();
        verify(receipts, never()).delete(any());
        verify(payments, never()).saveAndFlush(any());
    }

    @Test
    void rollbackKeepsThePdfAndCommitRemovesIt() throws Exception {
        ReglementClient payment = prepare();
        QuittancePrimeSelection receipt = archive(payment, "7/9/transaction.pdf");
        Path file = directory.resolve(receipt.getCheminStockage());
        TransactionSynchronizationManager.initSynchronization();
        service.delete(7L, 9L, 1L);
        assertThat(Files.exists(file)).isTrue();
        TransactionSynchronizationManager.getSynchronizations().forEach(sync ->
                sync.afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK));
        TransactionSynchronizationManager.clearSynchronization();
        assertThat(Files.exists(file)).isTrue();
        TransactionSynchronizationManager.initSynchronization();
        service.delete(7L, 9L, 1L);
        TransactionSynchronizationManager.getSynchronizations().forEach(TransactionSynchronization::afterCommit);
        assertThat(Files.exists(file)).isFalse();
    }

    @Test
    void failedDatabaseDeletionDoesNotDeleteThePdf() throws Exception {
        ReglementClient payment = prepare();
        QuittancePrimeSelection receipt = archive(payment, "7/9/failed.pdf");
        doThrow(new IllegalStateException("Database failed")).when(receipts).flush();
        assertThatThrownBy(() -> service.delete(7L, 9L, 1L)).isInstanceOf(IllegalStateException.class);
        assertThat(Files.exists(directory.resolve(receipt.getCheminStockage()))).isTrue();
    }

    @Test
    void reissuingDeletedLegacyAndNumberedFullArchivesAllocatesNewNumericReferences() throws Exception {
        ReglementClient payment = prepare();
        Map<String, QuittancePrimeSelection> issued = new HashMap<>();
        AtomicLong sequence = new AtomicLong();
        when(renderer.render(eq(payment), anyString(), any(), isNull())).thenReturn(new byte[]{1, 2, 3});
        when(receipts.findByAgenceIdAndReglementIdAndSelectionHash(eq(7L), eq(9L), anyString()))
                .thenAnswer(call -> Optional.ofNullable(issued.get(call.getArgument(2))));
        when(receipts.saveAndFlush(any())).thenAnswer(call -> {
            QuittancePrimeSelection receipt = call.getArgument(0);
            if (receipt.getId() == null) receipt.setId(sequence.incrementAndGet());
            issued.put(receipt.getSelectionHash(), receipt);
            return receipt;
        });
        when(receipts.findByIdAndAgenceIdAndReglementId(any(), eq(7L), eq(9L)))
                .thenAnswer(call -> issued.values().stream().filter(item -> item.getId().equals(call.getArgument(0))).findFirst());
        doAnswer(call -> {
            QuittancePrimeSelection receipt = call.getArgument(0);
            issued.remove(receipt.getSelectionHash());
            return null;
        }).when(receipts).delete(any());
        payment.setQuittancePrimeNumero("2026000009");
        payment.setQuittancePrimeDateEmission(java.time.LocalDate.now());
        payment.setQuittancePrimeCheminStockage("7/9/legacy.pdf");
        Path legacyFile = directory.resolve("7/9/legacy.pdf");
        Files.createDirectories(legacyFile.getParent());
        Files.write(legacyFile, new byte[]{5});
        service.delete(7L, 9L, null);
        assertThat(Files.exists(legacyFile)).isFalse();
        var first = service.issueAll(7L, 9L);
        assertThat(first.reference()).isNotEqualTo("2026000009");
        var original = issued.values().iterator().next();
        assertThat(original.getSelectionJson()).isEqualTo("null");
        assertThat(service.issueAll(7L, 9L).reference()).isEqualTo(first.reference());
        assertThat(service.readAll(7L, 9L).pdf()).containsExactly(first.pdf());
        service.delete(7L, 9L, original.getId());
        var reissued = service.issueAll(7L, 9L);
        assertThat(reissued.reference()).matches("[0-9]+").isNotEqualTo(first.reference());
        assertThat(Files.exists(directory.resolve(original.getCheminStockage()))).isFalse();
        assertThat(issued).hasSize(1);
        assertThat(payment.getStatut()).isEqualTo(StatutReglementClient.VALIDE);
    }

    @Test
    void archiveDeletionEndpointsRequireManagementPermission() throws Exception {
        Class<?> controller = com.assurance.controller.ReglementClientController.class;
        assertThat(controller.getMethod("deleteLegacyPremiumReceipt", Long.class)
                .getAnnotation(org.springframework.security.access.prepost.PreAuthorize.class).value())
                .isEqualTo("hasAuthority('PERM_reglement-client:manage')");
        assertThat(controller.getMethod("deletePremiumReceipt", Long.class, Long.class)
                .getAnnotation(org.springframework.security.access.prepost.PreAuthorize.class).value())
                .isEqualTo("hasAuthority('PERM_reglement-client:manage')");
    }

    private QuittancePrimeSelection archive(ReglementClient payment, String key) throws Exception {
        QuittancePrimeSelection receipt = new QuittancePrimeSelection();
        receipt.setId(1L);
        receipt.setAgence(payment.getAgence());
        receipt.setReglement(payment);
        receipt.setNumero("920260000000001");
        receipt.setCheminStockage(key);
        Path file = directory.resolve(key);
        Files.createDirectories(file.getParent());
        Files.write(file, new byte[]{1, 2, 3});
        when(receipts.findByIdAndAgenceIdAndReglementId(1L, 7L, 9L)).thenReturn(Optional.of(receipt));
        return receipt;
    }

    private ReglementClient prepare() {
        Agence agency = Agence.builder().nom("Cabinet").build();
        agency.setId(7L);
        ReglementClient payment = ReglementClient.builder().agence(agency).statut(StatutReglementClient.VALIDE).build();
        payment.setId(9L);
        when(payments.findByIdAndAgenceIdForUpdate(9L, 7L)).thenReturn(Optional.of(payment));
        when(payments.findByIdAndAgenceId(9L, 7L)).thenReturn(Optional.of(payment));
        when(renderer.policies(payment)).thenReturn(List.of(
                new QuittancePrimePdfService.PolicyOption("C:1", List.of("P1"), new BigDecimal("50.00"), true, List.of()),
                new QuittancePrimePdfService.PolicyOption("C:2", List.of("P2"), new BigDecimal("75.00"), true, List.of())));
        when(renderer.render(eq(payment), anyString(), any(), anySet())).thenReturn(new byte[]{1, 2, 3});
        when(storage.resolveClientPremiumReceipt(eq(7L), anyString()))
                .thenAnswer(call -> directory.resolve((String) call.getArgument(1)));
        return payment;
    }
}
