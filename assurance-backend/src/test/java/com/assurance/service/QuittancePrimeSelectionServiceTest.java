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
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

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
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class QuittancePrimeSelectionServiceTest {
    @TempDir
    Path directory;
    private final ReglementClientRepository payments = mock(ReglementClientRepository.class);
    private final QuittancePrimeSelectionRepository receipts = mock(QuittancePrimeSelectionRepository.class);
    private final QuittancePrimePdfService renderer = mock(QuittancePrimePdfService.class);
    private final StorageLayoutService storage = mock(StorageLayoutService.class);
    private final QuittancePrimeSelectionService service = new QuittancePrimeSelectionService(
            payments, receipts, renderer, storage, new ObjectMapper());

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

    private ReglementClient prepare() {
        Agence agency = Agence.builder().nom("Cabinet").build();
        agency.setId(7L);
        ReglementClient payment = ReglementClient.builder().agence(agency).statut(StatutReglementClient.VALIDE).build();
        payment.setId(9L);
        when(payments.findByIdAndAgenceIdForUpdate(9L, 7L)).thenReturn(Optional.of(payment));
        when(payments.findByIdAndAgenceId(9L, 7L)).thenReturn(Optional.of(payment));
        when(renderer.policies(payment)).thenReturn(List.of(
                new QuittancePrimePdfService.PolicyOption("C:1", List.of("P1"), new BigDecimal("50.00")),
                new QuittancePrimePdfService.PolicyOption("C:2", List.of("P2"), new BigDecimal("75.00"))));
        when(renderer.render(eq(payment), anyString(), any(), anySet())).thenReturn(new byte[]{1, 2, 3});
        when(storage.resolveClientPremiumReceipt(eq(7L), anyString()))
                .thenAnswer(call -> directory.resolve((String) call.getArgument(1)));
        return payment;
    }
}
