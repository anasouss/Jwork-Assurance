package com.assurance.service;

import com.assurance.entity.Agence;
import com.assurance.entity.DocumentClient;
import com.assurance.entity.LigneDocumentClient;
import com.assurance.enums.StatutDocumentClient;
import com.assurance.enums.TypeDocumentClient;
import com.assurance.exception.BadRequestException;
import com.itextpdf.io.font.constants.StandardFonts;
import com.itextpdf.io.image.ImageDataFactory;
import com.itextpdf.kernel.colors.Color;
import com.itextpdf.kernel.colors.DeviceRgb;
import com.itextpdf.kernel.font.PdfFont;
import com.itextpdf.kernel.font.PdfFontFactory;
import com.itextpdf.kernel.geom.PageSize;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.borders.Border;
import com.itextpdf.layout.borders.SolidBorder;
import com.itextpdf.layout.element.Cell;
import com.itextpdf.layout.element.Image;
import com.itextpdf.layout.element.Paragraph;
import com.itextpdf.layout.element.Table;
import com.itextpdf.layout.property.HorizontalAlignment;
import com.itextpdf.layout.property.TextAlignment;
import com.itextpdf.layout.property.UnitValue;
import com.itextpdf.layout.property.VerticalAlignment;
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
    private static final DeviceRgb ACCENT_SOFT = new DeviceRgb(234, 248, 243);
    private static final DeviceRgb DARK = new DeviceRgb(17, 34, 54);
    private static final DeviceRgb TEXT = new DeviceRgb(49, 61, 75);
    private static final DeviceRgb MUTED = new DeviceRgb(101, 113, 128);
    private static final DeviceRgb SURFACE = new DeviceRgb(246, 248, 250);
    private static final DeviceRgb BORDER = new DeviceRgb(211, 219, 228);
    private static final DeviceRgb DANGER = new DeviceRgb(185, 28, 28);
    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final DocumentClientService documentClientService;
    private final ReleveClientPdfRenderer releveClientPdfRenderer;

    @Transactional(readOnly = true)
    public byte[] generate(Long agenceId, Long documentId) {
        DocumentClient source = documentClientService.findDocument(agenceId, documentId);
        if (source.getTypeDocument() == TypeDocumentClient.RELEVE) {
            try {
                return releveClientPdfRenderer.render(source);
            } catch (Exception exception) {
                throw new BadRequestException("La génération du PDF a échoué");
            }
        }
        try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            PdfDocument pdf = new PdfDocument(new PdfWriter(output));
            Document document = new Document(pdf, PageSize.A4);
            document.setMargins(28, 32, 30, 32);
            PdfFont regular = PdfFontFactory.createFont(StandardFonts.HELVETICA);
            PdfFont bold = PdfFontFactory.createFont(StandardFonts.HELVETICA_BOLD);
            document.setFont(regular).setFontColor(TEXT);

            writeHeader(document, source, bold);
            writeDocumentMetadata(document, source, bold);
            writePayer(document, source, bold);
            writeLines(document, source, bold);
            writeTotals(document, source, bold);
            writeNotesAndLegalText(document, source, bold);
            writeAgencyFooter(document, source.getAgence());
            document.close();
            return output.toByteArray();
        } catch (Exception exception) {
            throw new BadRequestException("La génération du PDF a échoué");
        }
    }

    private void writeHeader(Document document, DocumentClient source, PdfFont bold) {
        Table header = new Table(new float[]{5.4f, 4.6f})
                .setWidth(UnitValue.createPercentValue(100));
        header.addCell(brandCell(source.getAgence(), bold));

        boolean statement = source.getTypeDocument() == TypeDocumentClient.RELEVE;
        Cell identity = borderless(new Cell())
                .setTextAlignment(TextAlignment.RIGHT)
                .setVerticalAlignment(VerticalAlignment.TOP)
                .add(new Paragraph(statement ? "RELEVÉ CLIENT" : "FACTURE")
                        .setFont(bold)
                        .setFontSize(18)
                        .setFontColor(DARK)
                        .setMargin(0))
                .add(new Paragraph(statement ? "SITUATION DE COMPTE" : "APPEL DE PRIME")
                        .setFont(bold)
                        .setFontSize(8)
                        .setFontColor(ACCENT)
                        .setMarginTop(3)
                        .setMarginBottom(9))
                .add(new Paragraph(source.getNumero())
                        .setFont(bold)
                        .setFontSize(10)
                        .setFontColor(TEXT)
                        .setMargin(0));
        header.addCell(identity);
        document.add(header);
        document.add(new Table(new float[]{1})
                .setWidth(UnitValue.createPercentValue(100))
                .addCell(new Cell().setHeight(3).setBackgroundColor(ACCENT).setBorder(Border.NO_BORDER))
                .setMarginTop(10)
                .setMarginBottom(12));

        if (source.getStatut() == StatutDocumentClient.ANNULE) {
            document.add(new Paragraph("DOCUMENT ANNULÉ")
                    .setFont(bold)
                    .setFontSize(10)
                    .setFontColor(DANGER)
                    .setBackgroundColor(new DeviceRgb(254, 242, 242))
                    .setBorder(new SolidBorder(new DeviceRgb(254, 202, 202), 0.8f))
                    .setPadding(7)
                    .setTextAlignment(TextAlignment.CENTER)
                    .setMarginBottom(10));
        }
    }

    private Cell brandCell(Agence agence, PdfFont bold) {
        Cell cell = borderless(new Cell()).setVerticalAlignment(VerticalAlignment.TOP);
        byte[] logo = agence.getLogoContenu();
        if (logo != null && logo.length > 0) {
            Image image = new Image(ImageDataFactory.create(logo));
            image.scaleToFit(180, 72);
            image.setHorizontalAlignment(HorizontalAlignment.LEFT);
            cell.add(image);
        } else {
            cell.add(new Paragraph(agence.getNom())
                    .setFont(bold)
                    .setFontSize(14)
                    .setFontColor(DARK)
                    .setMargin(0));
        }
        String contact = join(agence.getTelephone(), agence.getEmail());
        String location = join(agence.getAdresse(), agence.getVille());
        if (!"-".equals(location)) {
            cell.add(new Paragraph(location).setFontSize(7.5f).setFontColor(MUTED).setMarginTop(5).setMarginBottom(0));
        }
        if (!"-".equals(contact)) {
            cell.add(new Paragraph(contact).setFontSize(7.5f).setFontColor(MUTED).setMarginTop(2).setMarginBottom(0));
        }
        return cell;
    }

    private void writeDocumentMetadata(Document document, DocumentClient source, PdfFont bold) {
        Table metadata = new Table(new float[]{1, 1, 1})
                .setWidth(UnitValue.createPercentValue(100))
                .setMarginBottom(12);
        metadata.addCell(metadataCell("DATE D’ÉMISSION", date(source.getDateEmission()), bold));
        metadata.addCell(metadataCell(
                "PÉRIODE",
                date(source.getPeriodeDebut()) + " au " + date(source.getPeriodeFin()),
                bold
        ));
        metadata.addCell(metadataCell(
                source.getTypeDocument() == TypeDocumentClient.FACTURE ? "ÉCHÉANCE DE PAIEMENT" : "SOLDE AU",
                source.getTypeDocument() == TypeDocumentClient.FACTURE
                        ? date(source.getDateEcheance())
                        : date(source.getPeriodeFin()),
                bold
        ));
        document.add(metadata);
    }

    private Cell metadataCell(String label, String value, PdfFont bold) {
        return new Cell()
                .add(new Paragraph(label).setFont(bold).setFontSize(6.5f).setFontColor(MUTED).setMargin(0))
                .add(new Paragraph(value).setFont(bold).setFontSize(9).setFontColor(DARK).setMarginTop(4).setMarginBottom(0))
                .setBackgroundColor(SURFACE)
                .setBorder(new SolidBorder(BORDER, 0.7f))
                .setPadding(8);
    }

    private void writePayer(Document document, DocumentClient source, PdfFont bold) {
        Table payer = new Table(new float[]{1})
                .setWidth(UnitValue.createPercentValue(100))
                .setMarginBottom(12);
        Cell cell = new Cell()
                .add(new Paragraph("FACTURÉ À").setFont(bold).setFontSize(7).setFontColor(ACCENT).setMargin(0))
                .add(new Paragraph(source.getPayeurNom()).setFont(bold).setFontSize(11).setFontColor(DARK).setMarginTop(5).setMarginBottom(2))
                .add(new Paragraph(value(source.getPayeurIdentifiant())).setFontSize(7.5f).setFontColor(MUTED).setMargin(0))
                .add(new Paragraph(value(source.getPayeurAdresse())).setFontSize(7.5f).setFontColor(MUTED).setMarginTop(2).setMarginBottom(0))
                .setBorderLeft(new SolidBorder(ACCENT, 3))
                .setBorderTop(new SolidBorder(BORDER, 0.7f))
                .setBorderRight(new SolidBorder(BORDER, 0.7f))
                .setBorderBottom(new SolidBorder(BORDER, 0.7f))
                .setPadding(9);
        payer.addCell(cell);
        document.add(payer);
    }

    private void writeLines(Document document, DocumentClient source, PdfFont bold) {
        boolean statement = source.getTypeDocument() == TypeDocumentClient.RELEVE;
        document.add(new Paragraph(statement ? "MOUVEMENTS DE LA PÉRIODE" : "DÉTAIL DES PRIMES")
                .setFont(bold)
                .setFontSize(9)
                .setFontColor(DARK)
                .setMarginTop(2)
                .setMarginBottom(7));

        float[] widths = statement
                ? new float[]{1.0f, 2.1f, 1.5f, 2.0f, 1.3f, 1.3f}
                : new float[]{0.9f, 1.8f, 1.3f, 1.7f, 1.05f, 1.0f, 0.95f, 1.15f};
        Table table = new Table(widths)
                .setWidth(UnitValue.createPercentValue(100))
                .setKeepTogether(false);
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
                .forEach(line -> addLine(table, line, statement));
        document.add(table);
    }

    private void addLine(Table table, LigneDocumentClient line, boolean statement) {
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
    }

    private void writeTotals(Document document, DocumentClient source, PdfFont bold) {
        boolean statement = source.getTypeDocument() == TypeDocumentClient.RELEVE;
        Table total = new Table(new float[]{3, 2})
                .setWidth(UnitValue.createPercentValue(43))
                .setHorizontalAlignment(HorizontalAlignment.RIGHT)
                .setMarginTop(10);
        if (statement) {
            addTotalRow(total, "Total débit", source.getTotalDebit(), bold, false);
            addTotalRow(total, "Total crédit", source.getTotalCredit(), bold, false);
            addTotalRow(total, "Solde", source.getTotalDocument(), bold, true);
        } else {
            addTotalRow(total, "TOTAL À PAYER", source.getTotalDocument(), bold, true);
        }
        document.add(total);
    }

    private void addTotalRow(Table table, String label, BigDecimal amount, PdfFont bold, boolean primary) {
        Color background = primary ? ACCENT_SOFT : SURFACE;
        table.addCell(new Cell()
                .add(new Paragraph(label).setFont(bold).setFontSize(primary ? 9 : 8).setMargin(0))
                .setBackgroundColor(background)
                .setBorder(new SolidBorder(BORDER, 0.7f))
                .setPadding(7));
        table.addCell(new Cell()
                .add(new Paragraph(amount(amount) + " MAD").setFont(bold).setFontSize(primary ? 10 : 8).setMargin(0))
                .setTextAlignment(TextAlignment.RIGHT)
                .setFontColor(primary ? ACCENT : DARK)
                .setBackgroundColor(background)
                .setBorder(new SolidBorder(BORDER, 0.7f))
                .setPadding(7));
    }

    private void writeNotesAndLegalText(Document document, DocumentClient source, PdfFont bold) {
        if (source.getNotes() != null && !source.getNotes().isBlank()) {
            document.add(new Paragraph("NOTES")
                    .setFont(bold)
                    .setFontSize(7)
                    .setFontColor(MUTED)
                    .setMarginTop(14)
                    .setMarginBottom(4));
            document.add(new Paragraph(source.getNotes())
                    .setFontSize(8)
                    .setBorder(new SolidBorder(BORDER, 0.7f))
                    .setPadding(8)
                    .setMargin(0));
        }
        if (source.getStatut() == StatutDocumentClient.ANNULE && source.getMotifAnnulation() != null) {
            document.add(new Paragraph("Motif d’annulation : " + source.getMotifAnnulation())
                    .setFontSize(7.5f)
                    .setFontColor(DANGER)
                    .setMarginTop(10));
        }
        String legal = source.getTypeDocument() == TypeDocumentClient.FACTURE
                ? "Ce document est un appel de prime fondé sur les quittances détaillées. Il ne constitue pas une preuve de règlement."
                : "Ce relevé présente les quittances débitrices et créditrices enregistrées sur la période indiquée.";
        document.add(new Paragraph(legal)
                .setFontSize(7)
                .setFontColor(MUTED)
                .setMarginTop(14)
                .setMarginBottom(0));
    }

    private void writeAgencyFooter(Document document, Agence agence) {
        String footer = join(agence.getNom(), join(agence.getTelephone(), agence.getEmail()));
        document.add(new Paragraph(footer)
                .setFontSize(6.5f)
                .setFontColor(MUTED)
                .setBorderTop(new SolidBorder(BORDER, 0.6f))
                .setPaddingTop(7)
                .setMarginTop(16)
                .setTextAlignment(TextAlignment.CENTER));
    }

    private void addHeader(Table table, String value, PdfFont bold) {
        table.addHeaderCell(new Cell()
                .add(new Paragraph(value).setFont(bold).setFontSize(6.5f).setFontColor(DARK).setMargin(0))
                .setBackgroundColor(SURFACE)
                .setBorder(new SolidBorder(BORDER, 0.6f))
                .setPadding(5)
                .setVerticalAlignment(VerticalAlignment.MIDDLE));
    }

    private void addValue(Table table, String value, TextAlignment alignment) {
        table.addCell(new Cell()
                .add(new Paragraph(value).setFontSize(6.8f).setMargin(0))
                .setTextAlignment(alignment)
                .setVerticalAlignment(VerticalAlignment.MIDDLE)
                .setBorder(new SolidBorder(BORDER, 0.45f))
                .setPadding(5));
    }

    private Cell borderless(Cell cell) {
        return cell.setBorder(Border.NO_BORDER).setPadding(0);
    }

    private String date(LocalDate value) {
        return value == null ? "-" : value.format(DATE_FORMAT);
    }

    private String amount(BigDecimal value) {
        DecimalFormatSymbols symbols = DecimalFormatSymbols.getInstance(Locale.FRANCE);
        return new DecimalFormat("#,##0.00", symbols).format(value == null ? BigDecimal.ZERO : value);
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
