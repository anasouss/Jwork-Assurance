package com.assurance.service;

import com.assurance.entity.DocumentClient;
import com.assurance.entity.LigneDocumentClient;
import com.assurance.enums.TypeDocumentClient;
import com.assurance.enums.StatutDocumentClient;
import com.assurance.exception.BadRequestException;
import com.itextpdf.io.font.constants.StandardFonts;
import com.itextpdf.kernel.colors.DeviceRgb;
import com.itextpdf.kernel.font.PdfFont;
import com.itextpdf.kernel.font.PdfFontFactory;
import com.itextpdf.kernel.geom.PageSize;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.borders.SolidBorder;
import com.itextpdf.layout.element.Cell;
import com.itextpdf.layout.element.Paragraph;
import com.itextpdf.layout.element.Table;
import com.itextpdf.layout.property.TextAlignment;
import com.itextpdf.layout.property.UnitValue;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class DocumentClientPdfService {

    private static final DeviceRgb ACCENT = new DeviceRgb(0, 154, 112);
    private static final DeviceRgb DARK = new DeviceRgb(17, 34, 54);
    private static final DeviceRgb SOFT = new DeviceRgb(241, 245, 249);
    private static final DeviceRgb BORDER = new DeviceRgb(205, 214, 224);
    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final DocumentClientService documentClientService;

    @Transactional(readOnly = true)
    public byte[] generate(Long agenceId, Long documentId) {
        DocumentClient source = documentClientService.findDocument(agenceId, documentId);
        try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            PdfDocument pdf = new PdfDocument(new PdfWriter(output));
            Document document = new Document(pdf, PageSize.A4);
            document.setMargins(30, 32, 30, 32);
            PdfFont regular = PdfFontFactory.createFont(StandardFonts.HELVETICA);
            PdfFont bold = PdfFontFactory.createFont(StandardFonts.HELVETICA_BOLD);
            document.setFont(regular);

            writeHeader(document, source, bold);
            writePayer(document, source, bold);
            writeLines(document, source, bold);
            writeTotals(document, source, bold);
            writeFooter(document, source);
            document.close();
            return output.toByteArray();
        } catch (Exception exception) {
            throw new BadRequestException("La génération du PDF a échoué");
        }
    }

    private void writeHeader(Document document, DocumentClient source, PdfFont bold) {
        String title = source.getTypeDocument() == TypeDocumentClient.RELEVE
                ? "RELEVÉ CLIENT"
                : "FACTURE / APPEL DE PRIME";
        Table header = new Table(new float[]{6, 4}).setWidth(UnitValue.createPercentValue(100));
        header.addCell(borderless(new Cell()
                .add(new Paragraph(source.getAgence().getNom()).setFont(bold).setFontSize(14).setFontColor(DARK))
                .add(new Paragraph(value(source.getAgence().getAdresse())).setFontSize(8))
                .add(new Paragraph(join(source.getAgence().getVille(), source.getAgence().getTelephone())).setFontSize(8))));
        header.addCell(borderless(new Cell()
                .add(new Paragraph(title).setFont(bold).setFontSize(15).setFontColor(ACCENT))
                .add(new Paragraph(source.getNumero()).setFont(bold).setFontSize(11))
                .add(new Paragraph("Émis le " + date(source.getDateEmission())).setFontSize(9))
                .setTextAlignment(TextAlignment.RIGHT)));
        document.add(header);
        document.add(new Paragraph(" ").setMarginBottom(3));
        document.add(new Paragraph("Période du " + date(source.getPeriodeDebut()) + " au " + date(source.getPeriodeFin()))
                .setFontSize(9)
                .setFontColor(DARK)
                .setBorderBottom(new SolidBorder(ACCENT, 1.2f))
                .setPaddingBottom(7));
        if (source.getStatut() == StatutDocumentClient.ANNULE) {
            document.add(new Paragraph("DOCUMENT ANNULÉ")
                    .setFont(bold)
                    .setFontSize(11)
                    .setFontColor(new DeviceRgb(190, 24, 24))
                    .setTextAlignment(TextAlignment.CENTER)
                    .setMarginTop(8));
            document.add(new Paragraph("Motif : " + value(source.getMotifAnnulation()))
                    .setFontSize(8)
                    .setTextAlignment(TextAlignment.CENTER));
        }
    }

    private void writePayer(Document document, DocumentClient source, PdfFont bold) {
        Table payer = new Table(new float[]{1}).setWidth(UnitValue.createPercentValue(100)).setMarginTop(14);
        Cell cell = new Cell()
                .add(new Paragraph("PAYEUR").setFont(bold).setFontSize(8).setFontColor(ACCENT))
                .add(new Paragraph(source.getPayeurNom()).setFont(bold).setFontSize(11))
                .add(new Paragraph(value(source.getPayeurIdentifiant())).setFontSize(8))
                .add(new Paragraph(value(source.getPayeurAdresse())).setFontSize(8))
                .setBackgroundColor(SOFT)
                .setBorder(new SolidBorder(BORDER, 0.8f))
                .setPadding(9);
        if (source.getDateEcheance() != null) {
            cell.add(new Paragraph("Échéance de paiement : " + date(source.getDateEcheance()))
                    .setFont(bold).setFontSize(9).setMarginTop(4));
        }
        payer.addCell(cell);
        document.add(payer);
    }

    private void writeLines(Document document, DocumentClient source, PdfFont bold) {
        boolean statement = source.getTypeDocument() == TypeDocumentClient.RELEVE;
        float[] widths = statement
                ? new float[]{1.1f, 2.2f, 1.6f, 2.1f, 1.35f, 1.35f}
                : new float[]{1.0f, 1.8f, 1.25f, 1.8f, 1.05f, 1.0f, 1.0f, 1.15f};
        Table table = new Table(widths).setWidth(UnitValue.createPercentValue(100)).setMarginTop(14);
        addHeader(table, "DATE", bold);
        addHeader(table, "DOSSIER / POLICE", bold);
        addHeader(table, "QUITTANCE", bold);
        addHeader(table, "MOUVEMENT", bold);
        if (statement) {
            addHeader(table, "DÉBIT", bold);
            addHeader(table, "CRÉDIT", bold);
        } else {
            addHeader(table, "P. NETTE", bold);
            addHeader(table, "TAXES", bold);
            addHeader(table, "ACCESS.", bold);
            addHeader(table, "TTC", bold);
        }

        source.getLignes().stream()
                .sorted(Comparator.comparing(LigneDocumentClient::getOrdre))
                .forEach(line -> {
                    addValue(table, date(line.getDateOperation()), TextAlignment.LEFT);
                    addValue(table, join(line.getNumeroDossier(), line.getNumeroPolice()), TextAlignment.LEFT);
                    addValue(table, value(line.getNumeroQuittance()), TextAlignment.LEFT);
                    addValue(table, value(line.getMouvement()), TextAlignment.LEFT);
                    if (statement) {
                        addValue(table, amount(line.getDebit()), TextAlignment.RIGHT);
                        addValue(table, amount(line.getCredit()), TextAlignment.RIGHT);
                    } else {
                        addValue(table, amount(line.getPrimeNette()), TextAlignment.RIGHT);
                        addValue(table, amount(line.getTaxes()), TextAlignment.RIGHT);
                        addValue(table, amount(line.getAccessoires()), TextAlignment.RIGHT);
                        addValue(table, amount(line.getMontantTtc()), TextAlignment.RIGHT);
                    }
                });
        document.add(table);
    }

    private void writeTotals(Document document, DocumentClient source, PdfFont bold) {
        Table total = new Table(new float[]{3, 2}).setWidth(UnitValue.createPercentValue(42))
                .setHorizontalAlignment(com.itextpdf.layout.property.HorizontalAlignment.RIGHT)
                .setMarginTop(10);
        if (source.getTypeDocument() == TypeDocumentClient.RELEVE) {
            total.addCell(totalLabel("Total débit", bold));
            total.addCell(totalValue(source.getTotalDebit(), bold));
            total.addCell(totalLabel("Total crédit", bold));
            total.addCell(totalValue(source.getTotalCredit(), bold));
            total.addCell(totalLabel("Solde", bold));
        } else {
            total.addCell(totalLabel("Total à payer", bold));
        }
        total.addCell(totalValue(source.getTotalDocument(), bold));
        document.add(total);
    }

    private void writeFooter(Document document, DocumentClient source) {
        if (source.getNotes() != null && !source.getNotes().isBlank()) {
            document.add(new Paragraph("Notes : " + source.getNotes()).setFontSize(8).setMarginTop(14));
        }
        document.add(new Paragraph(
                source.getTypeDocument() == TypeDocumentClient.FACTURE
                        ? "Ce document constitue un appel de prime fondé sur les quittances détaillées ci-dessus."
                        : "Ce relevé récapitule les quittances débitrices et créditrices de la période."
        ).setFontSize(7).setFontColor(new DeviceRgb(90, 100, 114)).setMarginTop(16));
    }

    private void addHeader(Table table, String value, PdfFont bold) {
        table.addHeaderCell(new Cell().add(new Paragraph(value).setFont(bold).setFontSize(7))
                .setBackgroundColor(SOFT).setBorder(new SolidBorder(BORDER, 0.6f)).setPadding(5));
    }

    private void addValue(Table table, String value, TextAlignment alignment) {
        table.addCell(new Cell().add(new Paragraph(value).setFontSize(7))
                .setTextAlignment(alignment).setBorder(new SolidBorder(BORDER, 0.5f)).setPadding(5));
    }

    private Cell totalLabel(String value, PdfFont bold) {
        return new Cell().add(new Paragraph(value).setFont(bold).setFontSize(8))
                .setBackgroundColor(SOFT).setBorder(new SolidBorder(BORDER, 0.6f)).setPadding(6);
    }

    private Cell totalValue(BigDecimal value, PdfFont bold) {
        return new Cell().add(new Paragraph(amount(value) + " MAD").setFont(bold).setFontSize(8))
                .setTextAlignment(TextAlignment.RIGHT).setBorder(new SolidBorder(BORDER, 0.6f)).setPadding(6);
    }

    private Cell borderless(Cell cell) {
        return cell.setBorder(null).setPadding(0);
    }

    private String date(LocalDate value) {
        return value == null ? "-" : value.format(DATE_FORMAT);
    }

    private String amount(BigDecimal value) {
        DecimalFormatSymbols symbols = DecimalFormatSymbols.getInstance(Locale.FRANCE);
        DecimalFormat format = new DecimalFormat("#,##0.00", symbols);
        return format.format(value == null ? BigDecimal.ZERO : value);
    }

    private String join(String first, String second) {
        if (first == null || first.isBlank()) {
            return value(second);
        }
        if (second == null || second.isBlank()) {
            return first;
        }
        return first + " · " + second;
    }

    private String value(String value) {
        return value == null || value.isBlank() ? "-" : value;
    }
}
