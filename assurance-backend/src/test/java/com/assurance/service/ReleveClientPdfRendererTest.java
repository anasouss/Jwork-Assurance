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
                        "123 456 789 012,34", "12 345 678 901,23", "135 802 467 913,57");
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
}
