package com.assurance.service;

import com.assurance.entity.AffectationReglementClient;
import com.assurance.entity.Agence;
import com.assurance.entity.Contrat;
import com.assurance.entity.ElementFacturable;
import com.assurance.entity.InstrumentReglementClient;
import com.assurance.entity.ReglementClient;
import com.assurance.entity.Utilisateur;
import com.assurance.enums.ModeReglementClient;
import com.assurance.enums.StatutAffectationReglement;
import com.assurance.enums.StatutInstrumentReglement;
import com.assurance.enums.StatutReglementClient;
import com.assurance.repository.InstrumentReglementClientRepository;
import com.assurance.repository.ReglementClientRepository;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ReglementClientPdfServiceTest {

    private final ReglementClientRepository paymentRepository = mock(ReglementClientRepository.class);
    private final InstrumentReglementClientRepository instrumentRepository =
            mock(InstrumentReglementClientRepository.class);
    private final AgencyLogoStorageService logoStorageService = mock(AgencyLogoStorageService.class);

    @Test
    void groupsSeveralInstrumentsAllocatedToTheSameReceivable() throws Exception {
        ReglementClient payment = paymentWithElevenCheques();
        when(paymentRepository.findByIdAndAgenceId(50L, 1L)).thenReturn(Optional.of(payment));
        when(instrumentRepository.findByReglementIdAndAgenceIdOrderByIdAsc(50L, 1L))
                .thenReturn(payment.getInstruments());
        when(logoStorageService.loadBytesIfPresent(null)).thenReturn(null);

        ReglementClientPdfService service = new ReglementClientPdfService(
                paymentRepository,
                instrumentRepository,
                logoStorageService
        );
        byte[] bytes = service.generate(1L, 50L);
        Path previewDir = Path.of("target", "pdf-previews");
        Files.createDirectories(previewDir);
        Files.write(previewDir.resolve("reglement-client-affectations-regroupees.pdf"), bytes);

        try (PDDocument pdf = PDDocument.load(bytes)) {
            ImageIO.write(
                    new PDFRenderer(pdf).renderImageWithDPI(0, 140),
                    "png",
                    previewDir.resolve("reglement-client-affectations-regroupees.png").toFile()
            );
            String text = new PDFTextStripper().getText(pdf);
            assertThat(pdf.getNumberOfPages()).isEqualTo(1);
            assertThat(text)
                    .contains("11 moyens de paiement · 1 destination affectée")
                    .contains("MONTANT AFFECTÉ")
                    .contains("55 000,00");
            assertThat(occurrences(text, "Affaire nouvelle · 26500001 · MATU26-0021"))
                    .isEqualTo(1);
        }
    }

    private ReglementClient paymentWithElevenCheques() {
        Agence agency = Agence.builder()
                .code("AG")
                .nom("Ambition Ibtissam Assurances")
                .ville("Agadir")
                .adresse("Bureau 28, Immeuble Rimal 02, Founty Haut")
                .telephone("0528 39 0439")
                .build();
        agency.setId(1L);
        Utilisateur creator = Utilisateur.builder()
                .agence(agency)
                .email("agent@example.test")
                .password("test")
                .prenom("Mohammed")
                .nom("Melymane")
                .build();
        creator.setId(7L);
        Contrat contract = Contrat.builder()
                .agence(agency)
                .numeroPolice("26500001")
                .numeroDossier("MATU26-0021")
                .build();
        contract.setId(20L);
        ElementFacturable receivable = ElementFacturable.builder()
                .agence(agency)
                .contrat(contract)
                .libelle("Affaire nouvelle")
                .primeTotale(new BigDecimal("55000.00"))
                .build();
        receivable.setId(30L);
        ReglementClient payment = ReglementClient.builder()
                .agence(agency)
                .numero("REG-26-000005")
                .dateReglement(LocalDate.of(2026, 10, 13))
                .payeurNom("YASLID CARS")
                .statut(StatutReglementClient.VALIDE)
                .montantTotal(new BigDecimal("55000.00"))
                .montantNonAffecte(BigDecimal.ZERO)
                .creePar(creator)
                .instruments(new ArrayList<>())
                .build();
        payment.setId(50L);

        List<InstrumentReglementClient> instruments = payment.getInstruments();
        for (int index = 0; index < 11; index++) {
            InstrumentReglementClient instrument = InstrumentReglementClient.builder()
                    .agence(agency)
                    .reglement(payment)
                    .mode(ModeReglementClient.CHEQUE)
                    .statut(StatutInstrumentReglement.EN_ATTENTE)
                    .montant(new BigDecimal("5000.00"))
                    .dateInstrument(LocalDate.of(2026, 10, 13))
                    .dateEcheance(LocalDate.of(2026, 10, 13).plusMonths(index))
                    .dateStatut(LocalDate.of(2026, 10, 13))
                    .referenceInstrument(String.valueOf(5169578 + index))
                    .affectations(new ArrayList<>())
                    .build();
            instrument.setId(100L + index);
            AffectationReglementClient allocation = AffectationReglementClient.builder()
                    .instrument(instrument)
                    .elementFacturable(receivable)
                    .payeurNomSnapshot("YASLID CARS")
                    .montant(new BigDecimal("5000.00"))
                    .statut(StatutAffectationReglement.EN_ATTENTE)
                    .build();
            allocation.setId(200L + index);
            instrument.getAffectations().add(allocation);
            instruments.add(instrument);
        }
        return payment;
    }

    private int occurrences(String text, String value) {
        int count = 0;
        int position = 0;
        while ((position = text.indexOf(value, position)) >= 0) {
            count++;
            position += value.length();
        }
        return count;
    }
}
