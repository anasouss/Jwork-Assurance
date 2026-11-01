package com.assurance.service;

import com.assurance.entity.Agence;
import com.assurance.entity.ReglementClient;
import com.assurance.enums.StatutReglementClient;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.ReglementClientRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class QuittancePrimeClientServiceTest {
    @TempDir
    Path directory;
    private final ReglementClientRepository payments = mock(ReglementClientRepository.class);
    private final StorageLayoutService storage = mock(StorageLayoutService.class);
    private final QuittancePrimeSelectionService selections = mock(QuittancePrimeSelectionService.class);
    private final QuittancePrimeClientService service = new QuittancePrimeClientService(payments, storage, selections);

    @Test
    void existingLegacyArchivesAreReadWithoutBeingRewritten() throws Exception {
        ReglementClient payment = payment();
        when(payments.findByIdAndAgenceIdForUpdate(9L, 7L)).thenReturn(Optional.of(payment));
        when(storage.resolveClientPremiumReceipt(eq(7L), anyString())).thenReturn(directory.resolve("receipt.pdf"));
        String reference = LocalDate.now().getYear() + "000009";
        payment.setQuittancePrimeNumero(reference);
        payment.setQuittancePrimeDateEmission(LocalDate.now());
        payment.setQuittancePrimeCheminStockage("7/9/receipt.pdf");
        Files.write(directory.resolve("receipt.pdf"), new byte[]{1, 2, 3});
        var first = service.issue(7L, 9L);
        payment.setPayeurNom("Changed later");
        var second = service.issue(7L, 9L);
        assertThat(first.reference()).isEqualTo(reference).matches("[0-9]+");
        assertThat(second.pdf()).containsExactly(first.pdf());
        verifyNoInteractions(selections);
        verify(payments, never()).saveAndFlush(payment);
        assertThat(payment.getQuittancePrimeDateEmission()).isNotNull();
    }

    @Test
    void missingArchiveIsNotSilentlyRegenerated() {
        ReglementClient payment = payment();
        payment.setQuittancePrimeNumero("2026000009");
        payment.setQuittancePrimeDateEmission(LocalDate.now());
        payment.setQuittancePrimeCheminStockage("7/9/archive.pdf");
        when(payments.findByIdAndAgenceId(9L, 7L)).thenReturn(Optional.of(payment));
        when(storage.resolveClientPremiumReceipt(7L, "7/9/archive.pdf")).thenReturn(directory.resolve("missing.pdf"));
        assertThatThrownBy(() -> service.read(7L, 9L)).isInstanceOf(BadRequestException.class);
        verifyNoInteractions(selections);
    }

    @Test
    void cancelledAndCrossAgencyPaymentsCannotIssueAReceipt() {
        ReglementClient payment = payment();
        payment.setStatut(StatutReglementClient.ANNULE);
        when(payments.findByIdAndAgenceIdForUpdate(9L, 7L)).thenReturn(Optional.of(payment));
        assertThatThrownBy(() -> service.issue(7L, 9L)).isInstanceOf(BadRequestException.class);
        when(payments.findByIdAndAgenceIdForUpdate(9L, 8L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.issue(8L, 9L)).isInstanceOf(ResourceNotFoundException.class);
        verifyNoInteractions(selections, storage);
    }

    @Test
    void newFullPaymentReceiptsUseTheNumberedArchiveService() {
        ReglementClient payment = payment();
        when(payments.findByIdAndAgenceIdForUpdate(9L, 7L)).thenReturn(Optional.of(payment));
        var receipt = new QuittancePrimeClientService.Receipt("920260000000001", new byte[]{1});
        when(selections.issueAll(7L, 9L)).thenReturn(receipt);
        assertThat(service.issue(7L, 9L)).isEqualTo(receipt);
        when(payments.findByIdAndAgenceId(9L, 7L)).thenReturn(Optional.of(payment));
        when(selections.readAll(7L, 9L)).thenReturn(receipt);
        assertThat(service.read(7L, 9L)).isEqualTo(receipt);
        assertThat(payment.getQuittancePrimeNumero()).isNull();
        verifyNoInteractions(storage);
    }

    @Test
    void failedIssueDoesNotChangePaymentData() {
        ReglementClient payment = payment();
        when(payments.findByIdAndAgenceIdForUpdate(9L, 7L)).thenReturn(Optional.of(payment));
        when(selections.issueAll(7L, 9L)).thenThrow(new IllegalStateException("Save failed"));
        assertThatThrownBy(() -> service.issue(7L, 9L)).isInstanceOf(IllegalStateException.class);
        assertThat(payment.getQuittancePrimeNumero()).isNull();
        verifyNoInteractions(storage);
    }

    private ReglementClient payment() {
        Agence agency = Agence.builder().nom("Agency").build();
        agency.setId(7L);
        ReglementClient payment = ReglementClient.builder().agence(agency).numero("REG-2026-000009")
                .statut(StatutReglementClient.VALIDE).build();
        payment.setId(9L);
        return payment;
    }
}
