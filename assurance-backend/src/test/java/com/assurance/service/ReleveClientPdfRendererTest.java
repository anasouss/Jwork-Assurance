package com.assurance.service;

import com.assurance.entity.DocumentClient;
import com.assurance.entity.Client;
import com.assurance.entity.Contrat;
import com.assurance.entity.ContratClient;
import com.assurance.entity.ElementFacturable;
import com.assurance.entity.LigneDocumentClient;
import com.assurance.enums.RoleClientContrat;
import com.assurance.repository.ContratClientRepository;
import com.itextpdf.io.font.constants.StandardFonts;
import com.itextpdf.kernel.font.PdfFont;
import com.itextpdf.kernel.font.PdfFontFactory;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.layout.Document;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.util.Map;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;

class ReleveClientPdfRendererTest {
    private final ContratClientRepository contractClients = mock(ContratClientRepository.class);
    private final ReleveClientPdfRenderer renderer = new ReleveClientPdfRenderer(
            mock(AgencyLogoStorageService.class), mock(AgencySignatureStorageService.class),
            mock(FlottePolicePdfService.class), mock(DocumentClientLineLabelService.class),
            contractClients);

    @Test
    void amountsStayOnOneLineWithInsuredAndAdvanceColumnsInNormalAndDenseStatements() throws Exception {
        for (int count : List.of(3, 75)) {
            DocumentClient source = statement(count);
            source.setPayeurNom(null);
            var line = source.getLignes().get(0);
            line.setDateOperation(java.time.LocalDate.of(2026, 10, 1));
            line.setDateEcheance(java.time.LocalDate.of(2027, 9, 30));
            line.setPrimeNette(new BigDecimal("20402.76"));
            line.setTaxes(new BigDecimal("3450.39"));
            line.setMontantTtc(new BigDecimal("23904.16"));
            line.setDebit(new BigDecimal("23904.16"));
            line.setCredit(new BigDecimal("1000.00"));
            var large = source.getLignes().get(1);
            large.setPrimeNette(new BigDecimal("123456789012.34"));
            large.setTaxes(new BigDecimal("12345678901.23"));
            large.setMontantTtc(new BigDecimal("135802467913.57"));
            large.setDebit(new BigDecimal("135802467913.57"));
            try (PDDocument pdf = PDDocument.load(renderLinesAndTotals(source))) {
                String text = new PDFTextStripper().getText(pdf);
                assertThat(text).contains("20 402,76", "3 450,39", "23 904,16", "22 904,16",
                        "123 456 789 012,34", "12 345 678 901,23", "135 802 467 913,57", "01/10/26", "30/09/27");
                if (count == 75) assertThat(pdf.getNumberOfPages()).isGreaterThan(1);
            }
        }
    }

    @Test
    void hidesAdvanceColumnAndTotalWhenThereAreNoAdvances() throws Exception {
        DocumentClient source = statement(2);
        try (PDDocument pdf = PDDocument.load(renderLinesAndTotals(source))) {
            String text = new PDFTextStripper().getText(pdf);
            assertThat(text).contains("POL-1", "POL-2", "Total à payer", "200,00")
                    .doesNotContain("Acompte", "Total acompte", "Total TTC", "L’assuré");
        }
    }

    @Test
    void keepsInsuredColumnWhenAnyRowDiffersFromTheRecipient() throws Exception {
        DocumentClient source = statement(2);
        Contrat contract = Contrat.builder().build();
        contract.setId(7L);
        source.getLignes().get(1).setElementFacturable(ElementFacturable.builder().contrat(contract).build());
        Client client = Client.builder().nom("Autre assuré").build();
        when(contractClients.findByContratIdInAndRole(anyCollection(), eq(RoleClientContrat.SOUSCRIPTEUR)))
                .thenReturn(List.of(ContratClient.builder().contrat(contract).client(client).principalPourRole(true).build()));
        try (PDDocument pdf = PDDocument.load(renderLinesAndTotals(source))) {
            assertThat(new PDFTextStripper().getText(pdf)).contains("L’assuré", "Client test", "Autre assuré", "POL-1", "POL-2");
        }
    }

    @Test
    void hidesInsuredColumnForMatchingContractSubscriberNames() throws Exception {
        DocumentClient source = statement(1);
        Contrat contract = Contrat.builder().build();
        contract.setId(7L);
        source.getLignes().get(0).setElementFacturable(ElementFacturable.builder().contrat(contract).build());
        Client client = Client.builder().nom("Client test").build();
        when(contractClients.findByContratIdInAndRole(anyCollection(), eq(RoleClientContrat.SOUSCRIPTEUR)))
                .thenReturn(List.of(ContratClient.builder().contrat(contract).client(client).principalPourRole(true).build()));
        try (PDDocument pdf = PDDocument.load(renderLinesAndTotals(source))) {
            assertThat(new PDFTextStripper().getText(pdf)).contains("POL-1").doesNotContain("L’assuré");
        }
    }

    @Test
    void keepsAdvanceColumnForEveryPageWhenOneLineHasAnAdvance() throws Exception {
        DocumentClient source = statement(75);
        source.getLignes().get(74).setCredit(new BigDecimal("25.00"));
        source.setTotalCredit(new BigDecimal("25.00"));
        source.setTotalDocument(new BigDecimal("7475.00"));
        try (PDDocument pdf = PDDocument.load(renderLinesAndTotals(source))) {
            assertThat(pdf.getNumberOfPages()).isGreaterThan(1);
            PDFTextStripper stripper = new PDFTextStripper();
            String text = stripper.getText(pdf);
            assertThat(text).contains("Acompte", "Total à payer", "POL-75", "25,00", "7 475,00")
                    .doesNotContain("Total acompte", "Total TTC");
            stripper.setEndPage(1);
            assertThat(stripper.getText(pdf)).contains("Acompte");
        }
    }

    @Test
    void forgivenDifferenceDoesNotCountAsAnAdvance() throws Exception {
        DocumentClient source = statement(1);
        source.getLignes().get(0).setCredit(new BigDecimal("9.00"));
        source.getLignes().get(0).setEcartReglement(new BigDecimal("9.00"));
        source.setTotalCredit(new BigDecimal("9.00"));
        source.setTotalDocument(new BigDecimal("91.00"));
        try (PDDocument pdf = PDDocument.load(renderLinesAndTotals(source))) {
            assertThat(new PDFTextStripper().getText(pdf)).contains("91,00")
                    .doesNotContain("Acompte", "Total acompte");
        }
    }

    private DocumentClient statement(int count) {
        BigDecimal total = new BigDecimal("100.00").multiply(BigDecimal.valueOf(count));
        DocumentClient source = DocumentClient.builder().payeurNom("Client test")
                .totalDebit(total).totalCredit(BigDecimal.ZERO).totalDocument(total).build();
        for (int index = 1; index <= count; index++) {
            source.getLignes().add(LigneDocumentClient.builder().ordre(index).numeroPolice("POL-" + index)
                    .debit(new BigDecimal("100.00")).credit(BigDecimal.ZERO)
                    .primeNette(new BigDecimal("90.00")).taxes(new BigDecimal("10.00"))
                    .montantTtc(new BigDecimal("100.00")).build());
        }
        return source;
    }

    private byte[] renderLinesAndTotals(DocumentClient source) throws Exception {
        try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            Document document = new Document(new PdfDocument(new PdfWriter(output)));
            document.setFont(PdfFontFactory.createFont(StandardFonts.HELVETICA));
            PdfFont bold = PdfFontFactory.createFont(StandardFonts.HELVETICA_BOLD);
            boolean dense = source.getLignes().size() >= 9;
            ReflectionTestUtils.invokeMethod(renderer, "writeStatementLines", document, source, bold, bold, Map.of(), dense);
            ReflectionTestUtils.invokeMethod(renderer, "writeTotal", document, source, bold, dense);
            document.close();
            return output.toByteArray();
        }
    }

    @Test
    void conventionInvoiceUsesSavedConventionInsteadOfPersonalRecipientAndHidesReceiptNumbers() throws Exception {
        DocumentClient source = conventionInvoice(1);
        try (PDDocument pdf = PDDocument.load(renderer.render(source, false))) {
            PDFTextStripper firstPage = new PDFTextStripper();
            firstPage.setEndPage(1);
            assertThat(firstPage.getText(pdf)).contains("AOSFOC", "DÉSIGNATION", "PÉRIODE FACTURÉE", "MONTANT")
                    .doesNotContain("PAYEUR_CONFIDENTIEL", "ADRESSE_CONFIDENTIELLE", "ICE_CONFIDENTIEL");
            assertThat(new PDFTextStripper().getText(pdf)).contains("Assuré", "ASSURE_1", "POL-1", "TOTAL À PAYER")
                    .doesNotContain("CONTRAT-AN-", "Quittance N°", "(MAD)");
            assertThat(pdf.getNumberOfPages()).isEqualTo(2);
            for (var page : pdf.getPages()) {
                assertThat(page.getMediaBox().getHeight()).isGreaterThan(page.getMediaBox().getWidth());
                assertThat(page.getRotation()).isZero();
            }
        }
    }

    @Test
    void longConventionAnnexStaysPortraitAndRepeatsHeaders() throws Exception {
        try (PDDocument pdf = PDDocument.load(renderer.render(conventionInvoice(85), false))) {
            assertThat(pdf.getNumberOfPages()).isGreaterThan(2);
            assertThat(new PDFTextStripper().getText(pdf)).contains("POL-85", "8 500,00");
            for (int index = 1; index < pdf.getNumberOfPages(); index++) {
                var page = pdf.getPage(index);
                assertThat(page.getMediaBox().getHeight()).isGreaterThan(page.getMediaBox().getWidth());
                assertThat(page.getRotation()).isZero();
                PDFTextStripper pageText = new PDFTextStripper();
                pageText.setStartPage(index + 1);
                pageText.setEndPage(index + 1);
                assertThat(pageText.getText(pdf)).contains("Police N°", "Assuré");
            }
        }
    }

    private DocumentClient conventionInvoice(int count) {
        DocumentClient source = statement(count);
        source.setTypeDocument(com.assurance.enums.TypeDocumentClient.FACTURE);
        source.setAgence(com.assurance.entity.Agence.builder().nom("Agence test").ville("Agadir").build());
        source.setNumero("FAC-26-000012");
        source.setConventionFacturee("AOSFOC");
        source.setDateEmission(java.time.LocalDate.of(2026, 11, 13));
        source.setPeriodeDebut(java.time.LocalDate.of(2026, 1, 1));
        source.setPeriodeFin(java.time.LocalDate.of(2026, 3, 31));
        source.setPayeurNom("PAYEUR_CONFIDENTIEL");
        source.setPayeurAdresse("ADRESSE_CONFIDENTIELLE");
        source.setPayeurIce("ICE_CONFIDENTIEL");
        for (LigneDocumentClient line : source.getLignes()) {
            line.setAssureConvention("ASSURE_" + line.getOrdre());
            line.setNumeroQuittance("CONTRAT-AN-" + line.getOrdre());
            line.setCompagnie("MATU");
            line.setMouvement("Affaire nouvelle");
            line.setVehiculeConvention("35027-A-48");
            line.setDateOperation(source.getPeriodeDebut());
            line.setDateEcheance(java.time.LocalDate.of(2026, 12, 31));
            line.setMontantBulletinConvention(new BigDecimal("400.00"));
        }
        return source;
    }
}
