package com.assurance.service;

import com.assurance.entity.Agence;
import com.assurance.entity.DocumentClient;
import com.assurance.entity.LigneDocumentClient;
import com.assurance.enums.StatutDocumentClient;
import com.assurance.exception.BadRequestException;
import com.itextpdf.barcodes.BarcodeQRCode;
import com.itextpdf.io.font.constants.StandardFonts;
import com.itextpdf.io.image.ImageDataFactory;
import com.itextpdf.kernel.colors.ColorConstants;
import com.itextpdf.kernel.colors.DeviceRgb;
import com.itextpdf.kernel.font.PdfFont;
import com.itextpdf.kernel.font.PdfFontFactory;
import com.itextpdf.kernel.geom.PageSize;
import com.itextpdf.kernel.geom.Rectangle;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfPage;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.kernel.pdf.canvas.PdfCanvas;
import com.itextpdf.kernel.pdf.xobject.PdfFormXObject;
import com.itextpdf.layout.Canvas;
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
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.Locale;

@Component
@RequiredArgsConstructor
public class ReleveClientPdfRenderer {

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yy");
    private static final DateTimeFormatter LONG_DATE_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final SolidBorder TABLE_BORDER = new SolidBorder(ColorConstants.BLACK, 0.7f);
    private static final DeviceRgb TABLE_HEADER_COLOR = new DeviceRgb(20, 54, 88);
    private static final float PAGE_MARGIN = 10f;

    private final AgencyLogoStorageService agencyLogoStorageService;
    private final AgencySignatureStorageService agencySignatureStorageService;

    public byte[] render(DocumentClient source, boolean avecSignature) throws Exception {
        try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            PdfDocument pdf = new PdfDocument(new PdfWriter(output));
            Document document = new Document(pdf, PageSize.A4);
            document.setMargins(20, PAGE_MARGIN, 72, PAGE_MARGIN);

            PdfFont regular = PdfFontFactory.createFont(StandardFonts.HELVETICA);
            PdfFont bold = PdfFontFactory.createFont(StandardFonts.HELVETICA_BOLD);
            PdfFont tableHeader = PdfFontFactory.createFont(StandardFonts.TIMES_BOLD);
            document.setFont(regular).setFontSize(9.5f).setFontColor(ColorConstants.BLACK);

            writeLetterHead(document, pdf, source, bold);
            writeLetterIntroduction(document, source, regular, bold);
            writeClientReference(document, source, bold);
            writeStatementLines(document, source, bold, tableHeader);
            writeTotal(document, source, bold);
            writePaymentText(document, source);
            if (avecSignature) {
                writeSignature(document, source.getAgence());
            }
            if (source.getStatut() == StatutDocumentClient.ANNULE) {
                writeCancellation(document, source, bold);
            }
            writeFooters(pdf, source, regular);

            document.close();
            return output.toByteArray();
        }
    }

    private void writeLetterHead(Document document, PdfDocument pdf, DocumentClient source, PdfFont bold) {
        Table top = new Table(new float[]{7.8f, 2.2f})
                .setWidth(UnitValue.createPercentValue(100));
        Cell brand = borderless(new Cell()).setHeight(124).setVerticalAlignment(VerticalAlignment.TOP);
        byte[] logo = logoContent(source.getAgence());
        if (logo != null && logo.length > 0) {
            Image image = new Image(ImageDataFactory.create(logo));
            image.scaleToFit(260, 120);
            brand.add(image);
        } else {
            brand.add(new Paragraph(source.getAgence().getNom())
                    .setFont(bold)
                    .setFontSize(17)
                    .setMargins(8, 0, 0, 8));
        }
        top.addCell(brand);

        PdfFormXObject qrObject = new BarcodeQRCode(source.getNumero()).createFormXObject(ColorConstants.BLACK, pdf);
        Image qr = new Image(qrObject).setWidth(96).setHeight(96)
                .setHorizontalAlignment(HorizontalAlignment.CENTER);
        top.addCell(borderless(new Cell()).add(qr).setTextAlignment(TextAlignment.CENTER));
        document.add(top);

        document.add(new Paragraph(city(source.getAgence()) + " Le " + LONG_DATE_FORMAT.format(source.getDateEmission()))
                .setTextAlignment(TextAlignment.RIGHT)
                .setFontSize(9.5f)
                .setMarginTop(0)
                .setMarginRight(38)
                .setMarginBottom(1));

        Table recipient = new Table(new float[]{1})
                .setWidth(UnitValue.createPercentValue(52))
                .setHorizontalAlignment(HorizontalAlignment.RIGHT)
                .setMarginBottom(8);
        recipient.addCell(new Cell()
                .add(new Paragraph(value(source.getPayeurNom()))
                .setFont(bold)
                .setFontSize(11f)
                .setTextAlignment(TextAlignment.CENTER)
                .setMargin(0))
                .setBorder(TABLE_BORDER)
                .setPadding(3));
        recipient.addCell(new Cell()
                .add(new Paragraph(address(source.getPayeurAdresse()))
                        .setFontSize(9.5f)
                        .setTextAlignment(TextAlignment.CENTER)
                        .setMargin(0))
                .setMinHeight(40)
                .setBorderTop(Border.NO_BORDER)
                .setBorderRight(TABLE_BORDER)
                .setBorderBottom(TABLE_BORDER)
                .setBorderLeft(TABLE_BORDER)
                .setPaddings(8, 3, 4, 3));
        document.add(recipient);
    }

    private void writeLetterIntroduction(Document document, DocumentClient source, PdfFont regular, PdfFont bold) {
        Paragraph subject = new Paragraph()
                .setFontSize(10f)
                .setMarginTop(0)
                .setMarginLeft(7)
                .setMarginBottom(21);
        subject.add(new com.itextpdf.layout.element.Text("Objet : ").setFont(regular).setUnderline());
        subject.add(new com.itextpdf.layout.element.Text("Votre relevé de primes d'assurance").setFont(bold));
        document.add(subject);

        document.add(new Paragraph("Chères Mesdames, Chers Messieurs,")
                .setFontSize(10f)
                .setMarginLeft(7)
                .setMarginBottom(7));
        document.add(new Paragraph("Veuillez trouver ci-dessous le détail des primes relatives à vos contrats :")
                .setFontSize(10f)
                .setMarginLeft(7)
                .setMarginBottom(14));
    }

    private void writeClientReference(Document document, DocumentClient source, PdfFont bold) {
        Table reference = new Table(new float[]{2.7f, 0.5f, 1.2f})
                .setWidth(UnitValue.createPercentValue(39))
                .setMarginLeft(11)
                .setMarginBottom(12);
        reference.addCell(referenceCell("L’ID Client :", bold, TextAlignment.LEFT));
        reference.addCell(referenceCell("Réf :", null, TextAlignment.LEFT));
        reference.addCell(referenceCell(value(source.getPayeurIdentifiant()), null, TextAlignment.LEFT));
        document.add(reference);
    }

    private Cell referenceCell(String text, PdfFont font, TextAlignment alignment) {
        Paragraph paragraph = new Paragraph(text).setFontSize(9f).setMargin(0);
        if (font != null) {
            paragraph.setFont(font);
        }
        return new Cell()
                .add(paragraph)
                .setTextAlignment(alignment)
                .setVerticalAlignment(VerticalAlignment.MIDDLE)
                .setBorder(TABLE_BORDER)
                .setPadding(3);
    }

    private void writeStatementLines(
            Document document,
            DocumentClient source,
            PdfFont bold,
            PdfFont tableHeader
    ) {
        Table table = new Table(new float[]{17, 9.5f, 6.2f, 6.2f, 8, 6.5f, 7.5f, 7, 9, 23})
                .setWidth(UnitValue.createPercentValue(100))
                .setKeepTogether(false);
        addHeader(table, "L’assuré", tableHeader);
        addHeader(table, "Police N°", tableHeader);
        addHeader(table, "Du", tableHeader);
        addHeader(table, "Au", tableHeader);
        addHeader(table, "Prime Nette", tableHeader);
        addHeader(table, "Taxes", tableHeader);
        addHeader(table, "Montant\nTTC", tableHeader);
        addHeader(table, "Acompte", tableHeader);
        addHeader(table, "Reste à payer", tableHeader);
        addHeader(table, "Libellé", tableHeader);

        source.getLignes().stream()
                .sorted(Comparator.comparing(LigneDocumentClient::getOrdre))
                .forEach(line -> addStatementLine(table, source, line, bold));
        document.add(table);
    }

    private void addStatementLine(Table table, DocumentClient source, LigneDocumentClient line, PdfFont bold) {
        BigDecimal balance = money(line.getDebit()).subtract(money(line.getCredit()));
        addValue(table, source.getPayeurNom(), TextAlignment.LEFT, null);
        addValue(table, line.getNumeroPolice(), TextAlignment.CENTER, null);
        addValue(table, date(line.getDateOperation()), TextAlignment.CENTER, null);
        addValue(table, date(line.getDateEcheance()), TextAlignment.CENTER, null);
        addValue(table, amount(line.getPrimeNette()), TextAlignment.RIGHT, null);
        addValue(table, amount(line.getTaxes()), TextAlignment.RIGHT, null);
        addValue(table, amount(line.getMontantTtc()), TextAlignment.RIGHT, null);
        addValue(table, positiveAmount(line.getCredit()), TextAlignment.RIGHT, null);
        addValue(table, amount(balance), TextAlignment.RIGHT, bold);
        addValue(table, value(line.getMouvement()), TextAlignment.LEFT, null);
    }

    private void addHeader(Table table, String text, PdfFont font) {
        table.addHeaderCell(new Cell()
                .add(new Paragraph(text).setFont(font).setFontSize(8f).setMargin(0))
                .setFontColor(TABLE_HEADER_COLOR)
                .setTextAlignment(TextAlignment.CENTER)
                .setVerticalAlignment(VerticalAlignment.MIDDLE)
                .setBorder(TABLE_BORDER)
                .setPadding(3.2f));
    }

    private void addValue(Table table, String text, TextAlignment alignment, PdfFont font) {
        Paragraph paragraph = new Paragraph(value(text)).setFontSize(7.6f).setMargin(0);
        if (font != null) {
            paragraph.setFont(font);
        }
        table.addCell(new Cell()
                .add(paragraph)
                .setTextAlignment(alignment)
                .setVerticalAlignment(VerticalAlignment.MIDDLE)
                .setBorder(TABLE_BORDER)
                .setPadding(3.2f));
    }

    private void writeTotal(Document document, DocumentClient source, PdfFont bold) {
        Table total = new Table(new float[]{1.55f, 1})
                .setWidth(UnitValue.createPercentValue(24))
                .setHorizontalAlignment(HorizontalAlignment.RIGHT)
                .setMarginRight(134)
                .setMarginTop(9);
        total.addCell(new Cell()
                .add(new Paragraph("Total").setFont(bold).setFontSize(8.5f).setMargin(0))
                .setTextAlignment(TextAlignment.CENTER)
                .setBorder(TABLE_BORDER)
                .setPadding(4));
        total.addCell(new Cell()
                .add(new Paragraph(amount(source.getTotalDocument())).setFont(bold).setFontSize(8.5f).setMargin(0))
                .setTextAlignment(TextAlignment.RIGHT)
                .setBorder(TABLE_BORDER)
                .setPadding(4));
        document.add(total);
    }

    private void writePaymentText(Document document, DocumentClient source) {
        document.add(new Paragraph("Le montant total à régler s'élève à " + amount(source.getTotalDocument()) + " Dhs")
                .setFontSize(9.5f)
                .setMarginLeft(7)
                .setMarginTop(18)
                .setMarginBottom(3));
        document.add(new Paragraph("Dès réception de votre règlement, nous vous ferons parvenir la (les) quittance(s) correspondante(s).")
                .setFontSize(9.5f)
                .setMarginLeft(7)
                .setMarginTop(0));
    }

    private void writeSignature(Document document, Agence agence) {
        byte[] content = agencySignatureStorageService.loadBytesIfPresent(agence.getSignatureCheminStockage());
        if (content == null || content.length == 0) {
            throw new BadRequestException("Aucune signature n’est configurée pour cette agence");
        }
        Image signature = new Image(ImageDataFactory.create(content));
        signature.scaleToFit(150, 75);
        signature.setHorizontalAlignment(HorizontalAlignment.RIGHT);
        Table container = new Table(new float[]{1})
                .setWidth(UnitValue.createPercentValue(32))
                .setHorizontalAlignment(HorizontalAlignment.RIGHT)
                .setMarginRight(30)
                .setMarginTop(8);
        container.addCell(borderless(new Cell()).add(signature).setTextAlignment(TextAlignment.RIGHT));
        document.add(container);
    }

    private void writeCancellation(Document document, DocumentClient source, PdfFont bold) {
        String reason = source.getMotifAnnulation() == null ? "" : " - " + source.getMotifAnnulation();
        document.add(new Paragraph("DOCUMENT ANNULÉ" + reason)
                .setFont(bold)
                .setFontColor(ColorConstants.RED)
                .setTextAlignment(TextAlignment.CENTER)
                .setMarginTop(12));
    }

    private void writeFooters(PdfDocument pdf, DocumentClient source, PdfFont regular) {
        Agence agency = source.getAgence();
        for (int index = 1; index <= pdf.getNumberOfPages(); index++) {
            PdfPage page = pdf.getPage(index);
            Rectangle pageSize = page.getPageSize();
            PdfCanvas pdfCanvas = new PdfCanvas(page.newContentStreamAfter(), page.getResources(), pdf);
            pdfCanvas.setStrokeColor(ColorConstants.DARK_GRAY)
                    .setLineWidth(0.35f)
                    .moveTo(PAGE_MARGIN, 57)
                    .lineTo(pageSize.getWidth() - PAGE_MARGIN, 57)
                    .stroke();
            Canvas canvas = new Canvas(pdfCanvas, pdf, new Rectangle(
                    PAGE_MARGIN,
                    9,
                    pageSize.getWidth() - (PAGE_MARGIN * 2),
                    44
            ));
            String contacts = contactLine(agency);
            String location = addressLine(agency);
            String legal = legalLine(agency);
            String bank = bankLine(agency);
            if (!contacts.isBlank()) {
                canvas.add(footerParagraph(contacts, regular));
            }
            if (!location.isBlank()) {
                canvas.add(footerParagraph(location, regular));
            }
            if (!legal.isBlank()) {
                canvas.add(footerParagraph(legal, regular));
            }
            if (!bank.isBlank()) {
                canvas.add(footerParagraph(bank, regular));
            }
            canvas.add(footerParagraph("Relevé " + source.getNumero(), regular));
            canvas.close();
        }
    }

    private Paragraph footerParagraph(String text, PdfFont regular) {
        return new Paragraph(text)
                .setFont(regular)
                .setFontSize(7.2f)
                .setTextAlignment(TextAlignment.CENTER)
                .setMargin(0)
                .setMultipliedLeading(1.05f);
    }

    private String contactLine(Agence agency) {
        StringBuilder result = new StringBuilder();
        append(result, "GSM / Tél : ", agency.getTelephone());
        append(result, "Fax : ", agency.getFax());
        append(result, "Email : ", agency.getEmail());
        return result.toString();
    }

    private String addressLine(Agence agency) {
        StringBuilder result = new StringBuilder();
        append(result, "Adresse : ", join(agency.getAdresse(), agency.getVille()));
        append(result, "IF : ", agency.getIdentifiantFiscal());
        append(result, "Patente : ", agency.getPatente());
        append(result, "ICE : ", agency.getIce());
        return result.toString();
    }

    private String legalLine(Agence agency) {
        if (agency.getNumeroAgrement() == null || agency.getNumeroAgrement().isBlank()) {
            return "";
        }
        StringBuilder result = new StringBuilder("Intermédiaire d'assurances régi par la loi 17-99, portant code des assurances sous le n° d'agrément : ")
                .append(agency.getNumeroAgrement().trim());
        if (agency.getDateAgrement() != null) {
            result.append(" du ").append(DATE_FORMAT.format(agency.getDateAgrement()));
        }
        return result.toString();
    }

    private String bankLine(Agence agency) {
        StringBuilder result = new StringBuilder();
        append(result, "N° de compte bancaire : ", agency.getRib());
        append(result, "Banque : ", agency.getBanque());
        return result.toString();
    }

    private void append(StringBuilder target, String label, String content) {
        if (content == null || content.isBlank()) {
            return;
        }
        if (target.length() > 0) {
            target.append(" - ");
        }
        target.append(label).append(content.trim());
    }

    private String city(Agence agency) {
        return agency.getVille() == null || agency.getVille().isBlank() ? "" : agency.getVille().trim();
    }

    private byte[] logoContent(Agence agency) {
        return agencyLogoStorageService.loadBytesIfPresent(agency.getLogoCheminStockage());
    }

    private String address(String address) {
        return address == null || address.isBlank() ? "-" : address.trim().replace(",", "\n");
    }

    private String date(LocalDate date) {
        return date == null ? "-" : DATE_FORMAT.format(date);
    }

    private String positiveAmount(BigDecimal amount) {
        return money(amount).signum() == 0 ? "-" : amount(amount);
    }

    private String amount(BigDecimal amount) {
        DecimalFormatSymbols symbols = DecimalFormatSymbols.getInstance(Locale.FRANCE);
        String formatted = new DecimalFormat("#,##0.00", symbols).format(money(amount));
        return formatted.replace('\u202f', ' ').replace('\u00a0', ' ');
    }

    private BigDecimal money(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private String join(String first, String second) {
        if (first == null || first.isBlank()) {
            return second == null ? "" : second.trim();
        }
        if (second == null || second.isBlank()) {
            return first.trim();
        }
        return first.trim() + ", " + second.trim();
    }

    private String value(String value) {
        return value == null || value.isBlank() ? "-" : value.trim();
    }

    private Cell borderless(Cell cell) {
        return cell.setBorder(Border.NO_BORDER).setPadding(0);
    }
}
