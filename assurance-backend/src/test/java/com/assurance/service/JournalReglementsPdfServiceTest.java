package com.assurance.service;

import com.assurance.entity.Agence;
import com.assurance.entity.InstrumentReglementClient;
import com.assurance.entity.ReglementClient;
import com.assurance.enums.ModeReglementClient;
import com.assurance.enums.StatutReglementClient;
import com.assurance.exception.BadRequestException;
import com.assurance.repository.AgenceRepository;
import com.assurance.repository.AssistanceContratRepository;
import com.assurance.repository.ContratClientRepository;
import com.assurance.repository.InstrumentReglementClientRepository;
import com.assurance.repository.UtilisateurRepository;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class JournalReglementsPdfServiceTest {
    private static final LocalDate DAY = LocalDate.of(2026, 10, 30);
    private final InstrumentReglementClientRepository instruments = mock(InstrumentReglementClientRepository.class);
    private final AgenceRepository agencies = mock(AgenceRepository.class);
    private final JournalReglementsPdfService service = new JournalReglementsPdfService(
            instruments, mock(AssistanceContratRepository.class), mock(ContratClientRepository.class),
            agencies, mock(UtilisateurRepository.class), mock(AgencyLogoStorageService.class));

    @Test
    void dailyStatementHidesTheAllUsersBoxAndShowsPaymentModeSummary() throws Exception {
        prepare(List.of());
        try (PDDocument pdf = PDDocument.load(generate())) {
            String text = new PDFTextStripper().getText(pdf).replaceAll("\\s+", " ");
            assertThat(pdf.getNumberOfPages()).isEqualTo(1);
            assertThat(text).contains("Date de l’état : 30/10/2026", "UTILISATEUR", "MODE", "Détail des règlements",
                            "Récapitulatif par mode de règlement", "TOTAL (MAD)", "0,00")
                    .doesNotContain("Tous les modes", "Généré le", "Période", "PÉRIODE", "STATUT DU RÈGLEMENT",
                            "Tous les utilisateurs", "RÈGLEMENTS ACTIFS", "RÈGLEMENTS ANNULÉS", "MONTANT ANNULÉ", "Synthèse par moyen de paiement");
        }
    }

    @Test
    void summaryGroupsEachInstrumentOnceByMode() throws Exception {
        ReglementClient payment = ReglementClient.builder().numero("REG-TEST")
                .dateReglement(DAY).payeurNom("Client test").statut(StatutReglementClient.VALIDE).build();
        prepare(List.of(
                InstrumentReglementClient.builder().reglement(payment).mode(ModeReglementClient.CHEQUE)
                        .montant(new BigDecimal("200.00")).build(),
                InstrumentReglementClient.builder().reglement(payment).mode(ModeReglementClient.CHEQUE)
                        .montant(new BigDecimal("300.00")).build(),
                InstrumentReglementClient.builder().reglement(payment).mode(ModeReglementClient.ESPECES)
                        .montant(new BigDecimal("1000.00")).build()));
        try (PDDocument pdf = PDDocument.load(generate())) {
            String text = new PDFTextStripper().getText(pdf).replaceAll("\\s+", " ");
            String summary = text.substring(text.indexOf("Récapitulatif par mode de règlement"));
            assertThat(summary).contains("Espèces", "1 000,00", "Chèque", "500,00", "TOTAL (MAD)", "1 500,00")
                    .doesNotContain("Effet", "Virement", "Versement bancaire");
            assertThat(text.split("TOTAL", -1)).hasSize(2);
        }
    }

    @Test
    void multiPageStatementRetainsLastPaymentAndSingleTotal() throws Exception {
        prepare(IntStream.rangeClosed(1, 60).mapToObj(index -> InstrumentReglementClient.builder()
                .reglement(ReglementClient.builder().numero(String.format("R-%04d", index))
                        .dateReglement(DAY).payeurNom("Client test").statut(StatutReglementClient.VALIDE).build())
                .mode(ModeReglementClient.ESPECES).montant(new BigDecimal("1234.50")).build()).toList());
        try (PDDocument pdf = PDDocument.load(generate())) {
            assertThat(pdf.getNumberOfPages()).isGreaterThan(1);
            String text = new PDFTextStripper().getText(pdf).replaceAll("\\s+", " ");
            assertThat(text).contains("R-0060", "74 070,00", "TOTAL");
            assertThat(text.split("TOTAL", -1)).hasSize(2);
        }
    }

    @Test
    void refusesMultipleDatesForADailyStatement() {
        assertThatThrownBy(() -> service.generate(1L, DAY, DAY.plusDays(1), null, null, StatutReglementClient.VALIDE))
                .isInstanceOf(BadRequestException.class);
    }

    private void prepare(List<InstrumentReglementClient> rows) {
        when(agencies.findById(1L)).thenReturn(Optional.of(Agence.builder().nom("Agence test").build()));
        when(instruments.findForPaymentJournal(eq(1L), eq(DAY), eq(DAY),
                isNull(), anyList(), eq(StatutReglementClient.VALIDE))).thenReturn(rows);
    }

    private byte[] generate() {
        return service.generate(1L, DAY, DAY, null, null, StatutReglementClient.VALIDE);
    }
}
