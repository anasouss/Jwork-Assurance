package com.assurance.service;

import com.assurance.entity.AffectationReglementClient;
import com.assurance.entity.Agence;
import com.assurance.entity.Contrat;
import com.assurance.entity.DocumentClient;
import com.assurance.entity.ElementFacturable;
import com.assurance.entity.InstrumentReglementClient;
import com.assurance.entity.LigneDocumentClient;
import com.assurance.entity.ReglementClient;
import com.assurance.entity.Utilisateur;
import com.assurance.enums.ModeReglementClient;
import com.assurance.enums.StatutAffectationReglement;
import com.assurance.enums.StatutInstrumentReglement;
import com.assurance.enums.StatutReglementClient;
import com.assurance.enums.TypeDocumentClient;
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
                    .contains("Mode de règlement", "OPÉRATEUR", "TOTAL DU RÈGLEMENT (MAD)")
                    .contains("N° POLICE", "MOUVEMENT / PRESTATION", "26500001")
                    .contains("MONTANT AFFECTÉ")
                    .contains("55 000,00")
                    .doesNotContain("ÉCHÉANCE", "DATE CHÈQUE", "13/11/2026", "CRÉANCE / DOCUMENT", "MATU26-0021",
                            "DATE DU RÈGLEMENT", "ENREGISTRÉ PAR", "Non affecté", "Montant total");
            assertThat(text.substring(0, text.indexOf("Mode de règlement"))).doesNotContain("STATUT", "ENCAISSÉ");
            assertThat(text.substring(text.indexOf("Mode de règlement"), text.indexOf("Affectations")))
                    .doesNotContain("STATUT", "TOTAL DU RÈGLEMENT", "En attente de bordereau");
            assertThat(text.indexOf("TOTAL DU RÈGLEMENT")).isGreaterThan(text.indexOf("Affectations"));
            assertThat(occurrences(text, "TOTAL DU RÈGLEMENT")).isEqualTo(1);
            assertThat(occurrences(text, "Affaire nouvelle")).isEqualTo(1);
            assertThat(occurrences(text, "26500001")).isEqualTo(1);
        }
    }

    @Test
    void documentAllocationKeepsItsReferenceAndSnapshotPoliciesWithoutSplittingTheAmount() throws Exception {
        ReglementClient payment = paymentWithElevenCheques();
        DocumentClient invoice = DocumentClient.builder().typeDocument(TypeDocumentClient.FACTURE)
                .numero("FAC-TEST-001").build();
        invoice.setId(80L);
        invoice.getLignes().add(LigneDocumentClient.builder().numeroPolice("POL-SNAPSHOT-1").build());
        invoice.getLignes().add(LigneDocumentClient.builder().numeroPolice("POL-SNAPSHOT-2").build());
        payment.getInstruments().forEach(instrument -> instrument.getAffectations().forEach(allocation -> {
            allocation.setElementFacturable(null);
            allocation.setDocumentClient(invoice);
        }));
        when(paymentRepository.findByIdAndAgenceId(50L, 1L)).thenReturn(Optional.of(payment));
        when(instrumentRepository.findByReglementIdAndAgenceIdOrderByIdAsc(50L, 1L))
                .thenReturn(payment.getInstruments());
        ReglementClientPdfService service = new ReglementClientPdfService(
                paymentRepository, instrumentRepository, logoStorageService);
        try (PDDocument pdf = PDDocument.load(service.generate(1L, 50L))) {
            String text = new PDFTextStripper().getText(pdf).replaceAll("\\s+", " ");
            assertThat(text).contains("11 moyens de paiement · 1 destination affectée", "DOCUMENT",
                    "Facture FAC-TEST-001", "POL-SNAPSHOT-1", "POL-SNAPSHOT-2", "55 000,00");
            assertThat(occurrences(text, "Facture FAC-TEST-001")).isEqualTo(1);
        }
    }

    @Test
    void mixedPaymentOnlyShowsTheEffectMaturityDate() throws Exception {
        ReglementClient payment = paymentWithElevenCheques();
        payment.getInstruments().forEach(instrument -> instrument.setDateEcheance(LocalDate.of(2031, 12, 11)));
        InstrumentReglementClient effect = payment.getInstruments().get(0);
        effect.setMode(ModeReglementClient.EFFET);
        effect.setDateEcheance(LocalDate.of(2030, 12, 11));
        when(paymentRepository.findByIdAndAgenceId(50L, 1L)).thenReturn(Optional.of(payment));
        when(instrumentRepository.findByReglementIdAndAgenceIdOrderByIdAsc(50L, 1L))
                .thenReturn(payment.getInstruments());
        ReglementClientPdfService service = new ReglementClientPdfService(
                paymentRepository, instrumentRepository, logoStorageService);
        try (PDDocument pdf = PDDocument.load(service.generate(1L, 50L))) {
            assertThat(new PDFTextStripper().getText(pdf)).contains("ÉCHÉANCE", "11/12/2030")
                    .doesNotContain("11/12/2031", "DATE CHÈQUE");
        }
    }

    @Test
    void multiClientHeaderShowsTheRepresentativeAndOperatorWithoutDuplicatedStatuses() throws Exception {
        ReglementClient payment = paymentWithElevenCheques();
        payment.setMultiPayeur(true);
        payment.setPayeurNom("Plusieurs clients");
        payment.setDeposantNom("AGADIR 3");
        payment.getInstruments().forEach(instrument -> instrument.setStatut(StatutInstrumentReglement.CONFIRME));
        when(paymentRepository.findByIdAndAgenceId(50L, 1L)).thenReturn(Optional.of(payment));
        when(instrumentRepository.findByReglementIdAndAgenceIdOrderByIdAsc(50L, 1L)).thenReturn(payment.getInstruments());
        ReglementClientPdfService service = new ReglementClientPdfService(paymentRepository, instrumentRepository, logoStorageService);
        try (PDDocument pdf = PDDocument.load(service.generate(1L, 50L))) {
            String text = new PDFTextStripper().getText(pdf);
            String header = text.substring(0, text.indexOf("Mode de règlement"));
            assertThat(header).contains("REPRÉSENTANT", "AGADIR 3", "OPÉRATEUR", "Mohammed Melymane", "Agadir");
            assertThat(header).doesNotContain("Plusieurs clients", "Déposant", "STATUT", "ENCAISSÉ", "DATE DU RÈGLEMENT");
            assertThat(text.substring(text.indexOf("Mode de règlement"), text.indexOf("Affectations"))).doesNotContain("STATUT", "Confirmé");
        }
    }

    @Test
    void longAllocationTablesShowThePaymentTotalOnlyOnceAtTheEnd() throws Exception {
        ReglementClient payment = paymentWithElevenCheques();
        InstrumentReglementClient instrument = payment.getInstruments().get(0);
        payment.getInstruments().clear();
        payment.getInstruments().add(instrument);
        instrument.getAffectations().clear();
        payment.setMontantTotal(new BigDecimal("600.00"));
        instrument.setMontant(payment.getMontantTotal());
        for (int index = 0; index < 60; index++) {
            Contrat contract = Contrat.builder().numeroPolice("POL-LAYOUT-" + index).build();
            ElementFacturable element = ElementFacturable.builder().contrat(contract).libelle("Assistance voyage").build();
            element.setId(1000L + index);
            AffectationReglementClient allocation = AffectationReglementClient.builder().instrument(instrument)
                    .elementFacturable(element).payeurNomSnapshot("Client " + index).montant(new BigDecimal("10.00"))
                    .statut(StatutAffectationReglement.CONFIRMEE).build();
            allocation.setId(2000L + index);
            instrument.getAffectations().add(allocation);
        }
        when(paymentRepository.findByIdAndAgenceId(50L, 1L)).thenReturn(Optional.of(payment));
        when(instrumentRepository.findByReglementIdAndAgenceIdOrderByIdAsc(50L, 1L)).thenReturn(payment.getInstruments());
        ReglementClientPdfService service = new ReglementClientPdfService(paymentRepository, instrumentRepository, logoStorageService);
        try (PDDocument pdf = PDDocument.load(service.generate(1L, 50L))) {
            String text = new PDFTextStripper().getText(pdf);
            assertThat(pdf.getNumberOfPages()).isGreaterThan(1);
            assertThat(occurrences(text, "TOTAL DU RÈGLEMENT")).isEqualTo(1);
            assertThat(text.indexOf("TOTAL DU RÈGLEMENT")).isGreaterThan(text.indexOf("POL-LAYOUT-59"));
            assertThat(text).contains("600,00");
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
