package com.assurance.service;

import com.assurance.entity.DocumentClient;
import com.assurance.entity.EcheanceFacturationConvention;
import com.assurance.entity.LigneDocumentClient;
import com.assurance.enums.StatutEcheanceFacturationConvention;
import com.assurance.exception.BadRequestException;
import com.assurance.repository.EcheanceFacturationConventionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ConventionInvoiceRevisionPreviewTest {
    @Mock private DocumentClientService documents;
    @Mock private EcheanceFacturationConventionRepository schedules;
    @InjectMocks private FacturationConventionService service;

    @Test
    void retainedLinesUseOriginalSnapshotAmounts() {
        DocumentClient original = invoice();
        when(documents.requireConventionRevision(7L, 12L)).thenReturn(original);

        var preview = service.previewRevision(7L, 12L, List.of(8L));

        assertThat(preview.total()).isEqualByComparingTo("445.27");
        assertThat(preview.lignes()).hasSize(1);
        assertThat(preview.lignes().get(0).numeroPolice()).isEqualTo("POLICE-8");
        verifyNoInteractions(schedules);
    }

    @Test
    void unknownOrOtherAgencyAdditionsAreRejected() {
        when(documents.requireConventionRevision(7L, 12L)).thenReturn(invoice());
        when(schedules.findSelected(7L, List.of(999L))).thenReturn(List.of());

        assertThatThrownBy(() -> service.previewRevision(7L, 12L, List.of(8L, 999L)))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("introuvables");
    }

    @Test
    void alreadyBilledAdditionIsRejected() {
        when(documents.requireConventionRevision(7L, 12L)).thenReturn(invoice());
        var billed = EcheanceFacturationConvention.builder().actif(true)
                .statut(StatutEcheanceFacturationConvention.FACTUREE).build();
        billed.setId(10L);
        when(schedules.findSelected(7L, List.of(10L))).thenReturn(List.of(billed));

        assertThatThrownBy(() -> service.previewRevision(7L, 12L, List.of(8L, 10L)))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("a facturer");
    }

    @Test
    void cannotChangeInvoiceDirectionOrEmitAnEmptySelection() {
        DocumentClient original = invoice();
        original.getLignes().get(0).setMontantTtc(new BigDecimal("-445.27"));
        when(documents.requireConventionRevision(7L, 12L)).thenReturn(original);

        assertThatThrownBy(() -> service.previewRevision(7L, 12L, List.of(8L)))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("séparées");
        assertThatThrownBy(() -> service.previewRevision(7L, 12L, List.of()))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("non nul");
    }

    private DocumentClient invoice() {
        DocumentClient invoice = DocumentClient.builder().totalDocument(new BigDecimal("752.43"))
                .periodeDebut(LocalDate.of(2026, 7, 1)).periodeFin(LocalDate.of(2026, 9, 30)).build();
        invoice.getLignes().add(line(8L, "445.27"));
        invoice.getLignes().add(line(9L, "307.16"));
        return invoice;
    }

    private LigneDocumentClient line(Long id, String amount) {
        var schedule = EcheanceFacturationConvention.builder().build();
        schedule.setId(id);
        return LigneDocumentClient.builder().echeanceFacturationConvention(schedule)
                .numeroPolice("POLICE-" + id).montantTtc(new BigDecimal(amount)).build();
    }
}
