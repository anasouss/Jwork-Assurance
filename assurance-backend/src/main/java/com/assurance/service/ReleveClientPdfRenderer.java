package com.assurance.service;

import com.assurance.entity.Agence;
import com.assurance.entity.Contrat;
import com.assurance.entity.ContratClient;
import com.assurance.entity.DocumentClient;
import com.assurance.entity.LigneDocumentClient;
import com.assurance.enums.NatureElementFacturable;
import com.assurance.enums.RoleClientContrat;
import com.assurance.enums.StatutDocumentClient;
import com.assurance.enums.TypeContrat;
import com.assurance.enums.TypeDocumentClient;
import com.assurance.exception.BadRequestException;
import com.assurance.repository.ContratClientRepository;
import com.itextpdf.barcodes.BarcodeQRCode;
import com.itextpdf.io.font.constants.StandardFonts;
import com.itextpdf.io.image.ImageDataFactory;
import com.itextpdf.kernel.colors.ColorConstants;
import com.itextpdf.kernel.colors.DeviceRgb;
import com.itextpdf.kernel.font.PdfFont;
import com.itextpdf.kernel.font.PdfFontFactory;
import com.itextpdf.kernel.geom.PageSize;
import com.itextpdf.kernel.geom.Rectangle;
import com.itextpdf.kernel.events.PdfDocumentEvent;
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
import com.itextpdf.layout.renderer.CellRenderer;
import com.itextpdf.layout.renderer.DrawContext;
import com.itextpdf.layout.renderer.IRenderer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
@Slf4j
public class ReleveClientPdfRenderer {

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yy");
    private static final DateTimeFormatter LONG_DATE_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DeviceRgb BRAND_BLUE = new DeviceRgb(17, 48, 78);
    private static final DeviceRgb ACCENT_BLUE = new DeviceRgb(0, 147, 211);
    private static final DeviceRgb TABLE_HEADER_BLUE = new DeviceRgb(35, 78, 116);
    private static final DeviceRgb LIGHT_BLUE = new DeviceRgb(232, 244, 250);
    private static final DeviceRgb SOFT_GRAY = new DeviceRgb(241, 244, 247);
    private static final DeviceRgb BORDER_COLOR = new DeviceRgb(157, 171, 184);
    private static final SolidBorder TABLE_BORDER = new SolidBorder(BRAND_BLUE, 0.65f);
    private static final SolidBorder BODY_BORDER = new SolidBorder(BORDER_COLOR, 0.4f);
    private static final float PAGE_MARGIN = 24f;
    private static final String[] SMALL_NUMBERS = {
            "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf",
            "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize"
    };
    private static final String[] TENS = {
            "", "dix", "vingt", "trente", "quarante", "cinquante", "soixante"
    };

    private final AgencyLogoStorageService agencyLogoStorageService;
    private final AgencySignatureStorageService agencySignatureStorageService;
    private final FlottePolicePdfService flottePolicePdfService;
    private final DocumentClientLineLabelService lineLabelService;
    private final ContratClientRepository contratClientRepository;

    public byte[] render(DocumentClient source, boolean avecSignature) throws Exception {
        try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            PdfDocument pdf = new PdfDocument(new PdfWriter(output));
            Document document = new Document(pdf, PageSize.A4);
            document.setMargins(22, PAGE_MARGIN, 72, PAGE_MARGIN);

            PdfFont regular = PdfFontFactory.createFont(StandardFonts.HELVETICA);
            PdfFont bold = PdfFontFactory.createFont(StandardFonts.HELVETICA_BOLD);
            PdfFont italic = PdfFontFactory.createFont(StandardFonts.HELVETICA_OBLIQUE);
            pdf.addEventHandler(
                    PdfDocumentEvent.END_PAGE,
                    event -> writeFooter((PdfDocumentEvent) event, source, regular, bold)
            );
            document.setFont(regular).setFontSize(9.5f).setFontColor(ColorConstants.BLACK);
            Map<LigneDocumentClient, Integer> fleetAnnexes = fleetAnnexes(source);

            writeLetterHead(document, pdf, source, bold);
            writeLetterIntroduction(document, source, regular, bold);
            if (!isInvoice(source)) {
                writeClientReference(document, source, bold);
            }
            writeDocumentLines(document, source, bold, bold, fleetAnnexes);
            if (!isInvoice(source)) {
                writeTotal(document, source, bold);
            }
            writePaymentText(document, source, bold, italic);
            if (avecSignature && isInvoice(source)) {
                writeSignature(document, source.getAgence(), true);
            }
            writeNotes(document, source, bold);
            if (avecSignature && !isInvoice(source)) {
                writeSignature(document, source.getAgence(), false);
            }
            if (source.getStatut() == StatutDocumentClient.ANNULE) {
                writeCancellation(document, source, bold);
            } else if (source.getStatut() == StatutDocumentClient.REMPLACE) {
                writeReplacement(document, source, bold);
            }
            writeFleetAnnexes(document, source, fleetAnnexes);

            document.close();
            return output.toByteArray();
        }
    }

    private void writeLetterHead(Document document, PdfDocument pdf, DocumentClient source, PdfFont bold) {
        Table top = new Table(new float[]{7.8f, 2.2f})
                .setWidth(UnitValue.createPercentValue(100));
        Cell brand = borderless(new Cell())
                .setHeight(128)
                .setVerticalAlignment(VerticalAlignment.TOP);
        byte[] logo = logoContent(source.getAgence());
        if (logo != null && logo.length > 0) {
            Image image = new Image(ImageDataFactory.create(logo));
            image.scaleToFit(310, 118);
            brand.add(image);
        } else {
            brand.add(new Paragraph(source.getAgence().getNom())
                    .setFont(bold)
                    .setFontSize(17)
                    .setMargins(8, 0, 0, 8));
        }
        top.addCell(brand);

        PdfFormXObject qrObject = new BarcodeQRCode(source.getNumero()).createFormXObject(ColorConstants.BLACK, pdf);
        Image qr = new Image(qrObject).setWidth(62).setHeight(62)
                .setHorizontalAlignment(HorizontalAlignment.RIGHT);
        top.addCell(borderless(new Cell())
                .add(qr)
                .setTextAlignment(TextAlignment.RIGHT)
                .setVerticalAlignment(VerticalAlignment.TOP));
        document.add(top);

        document.add(new Paragraph(city(source.getAgence()) + " Le " + LONG_DATE_FORMAT.format(source.getDateEmission()))
                .setTextAlignment(TextAlignment.RIGHT)
                .setFontSize(9f)
                .setFontColor(BRAND_BLUE)
                .setMarginTop(5)
                .setMarginRight(0)
                .setMarginBottom(4));

        Table recipient = new Table(new float[]{1})
                .setWidth(UnitValue.createPercentValue(46))
                .setHorizontalAlignment(HorizontalAlignment.RIGHT)
                .setMarginBottom(14);
        recipient.addCell(new Cell()
                .add(new Paragraph(value(source.getPayeurNom()))
                .setFont(bold)
                .setFontSize(9.5f)
                .setFontColor(BRAND_BLUE)
                .setTextAlignment(TextAlignment.CENTER)
                .setMargin(0))
                .setBorder(TABLE_BORDER)
                .setBackgroundColor(LIGHT_BLUE)
                .setPadding(4));
        Cell recipientDetails = new Cell()
                .add(new Paragraph(address(source.getPayeurAdresse()).toUpperCase(Locale.FRENCH))
                        .setFontSize(8.5f)
                        .setTextAlignment(TextAlignment.CENTER)
                        .setMargin(0))
                .setMinHeight(32)
                .setBorderTop(Border.NO_BORDER)
                .setBorderRight(TABLE_BORDER)
                .setBorderBottom(TABLE_BORDER)
                .setBorderLeft(TABLE_BORDER)
                .setPaddings(5, 4, 4, 4);
        String payerIce = payerIce(source);
        if (isInvoice(source) && payerIce != null) {
            recipientDetails.add(new Paragraph()
                    .add(new com.itextpdf.layout.element.Text("ICE : ").setFont(bold))
                    .add(payerIce)
                    .setFontSize(8.5f)
                    .setTextAlignment(TextAlignment.CENTER)
                    .setMarginTop(3)
                    .setMarginBottom(0));
        }
        recipient.addCell(recipientDetails);
        document.add(recipient);
    }

    private void writeLetterIntroduction(Document document, DocumentClient source, PdfFont regular, PdfFont bold) {
        if (isInvoice(source)) {
            Paragraph invoiceNumber = new Paragraph()
                    .setFontSize(10f)
                    .setMargin(0);
            invoiceNumber.add(new com.itextpdf.layout.element.Text("Facture N° : ")
                    .setFont(regular)
                    .setUnderline());
            invoiceNumber.add(new com.itextpdf.layout.element.Text(value(source.getNumero())).setFont(bold));

            invoiceNumber.setMarginBottom(14);
            document.add(invoiceNumber);
            return;
        }

        Paragraph subject = new Paragraph()
                .setFontSize(10f)
                .setFontColor(BRAND_BLUE)
                .setMarginTop(0)
                .setMarginLeft(0)
                .setMarginBottom(16);
        subject.add(new com.itextpdf.layout.element.Text("Objet : ").setFont(regular).setUnderline());
        subject.add(new com.itextpdf.layout.element.Text("Votre relevé de primes d'assurance").setFont(bold));
        document.add(subject);

        document.add(new Paragraph("Cher client,")
                .setFontSize(10f)
                .setMarginLeft(0)
                .setMarginBottom(7));
        document.add(new Paragraph("Veuillez trouver ci-dessous le détail des primes relatives à vos contrats :")
                .setFontSize(10f)
                .setMarginLeft(0)
                .setMarginBottom(14));
    }

    private void writeClientReference(Document document, DocumentClient source, PdfFont bold) {
        Table reference = new Table(new float[]{2.7f, 2.4f})
                .setWidth(UnitValue.createPercentValue(48))
                .setMarginLeft(0)
                .setMarginBottom(14);
        reference.addCell(referenceCell("L’ID Client :", value(source.getPayeurIdentifiant()), bold));
        reference.addCell(referenceCell("Réf :", value(source.getNumero()), bold));
        document.add(reference);
    }

    private Cell referenceCell(String label, String value, PdfFont bold) {
        Paragraph paragraph = new Paragraph()
                .add(new com.itextpdf.layout.element.Text(label + " ").setFont(bold))
                .add(value)
                .setFontSize(9f)
                .setMargin(0);
        return new Cell()
                .add(paragraph)
                .setTextAlignment(TextAlignment.LEFT)
                .setVerticalAlignment(VerticalAlignment.MIDDLE)
                .setBorder(TABLE_BORDER)
                .setBackgroundColor(SOFT_GRAY)
                .setPadding(4);
    }

    private void writeDocumentLines(
            Document document,
            DocumentClient source,
            PdfFont bold,
            PdfFont tableHeader,
            Map<LigneDocumentClient, Integer> fleetAnnexes
    ) {
        if (isInvoice(source)) {
            writeInvoiceLines(document, source, bold, tableHeader, fleetAnnexes);
            return;
        }

        writeStatementLines(document, source, bold, tableHeader, fleetAnnexes);
    }

    private void writeStatementLines(
            Document document,
            DocumentClient source,
            PdfFont bold,
            PdfFont tableHeader,
            Map<LigneDocumentClient, Integer> fleetAnnexes
    ) {
        Table table = new Table(new float[]{17, 9.5f, 6.2f, 6.2f, 8, 6.5f, 7.5f, 7, 9, 23})
                .setWidth(UnitValue.createPercentValue(100))
                .setKeepTogether(false);
        addHeader(table, "L’assuré", tableHeader);
        addHeader(table, "Police", tableHeader);
        addHeader(table, "Du", tableHeader);
        addHeader(table, "Au", tableHeader);
        addHeader(table, "Prime Nette", tableHeader);
        addHeader(table, "Taxes", tableHeader);
        addHeader(table, "Montant\nTTC", tableHeader);
        addHeader(table, "Acompte", tableHeader);
        addHeader(table, "Reste à payer", tableHeader);
        addHeader(table, "Libellé", tableHeader);

        Map<Long, String> subscriberNames = subscriberNames(source);
        source.getLignes().stream()
                .sorted(Comparator.comparing(LigneDocumentClient::getOrdre))
                .forEach(line -> addStatementLine(
                        table,
                        source,
                        line,
                        bold,
                        fleetAnnexes.get(line),
                        subscriberNames
                ));
        document.add(table);
    }

    private void writeInvoiceLines(
            Document document,
            DocumentClient source,
            PdfFont bold,
            PdfFont tableHeader,
            Map<LigneDocumentClient, Integer> fleetAnnexes
    ) {
        Table table = new Table(new float[]{14, 8, 8, 22, 9, 8, 8, 10})
                .setWidth(UnitValue.createPercentValue(100))
                .setKeepTogether(false);
        addHeader(table, "Police", tableHeader);
        addHeader(table, "Date effet", tableHeader);
        addHeader(table, "Date exp.", tableHeader);
        addHeader(table, "Nature", tableHeader);
        addHeader(table, "Prime nette", tableHeader);
        addHeader(table, "Taxes", tableHeader);
        addHeader(table, "Access.", tableHeader);
        addHeader(table, "Total", tableHeader);

        source.getLignes().stream()
                .sorted(Comparator.comparing(LigneDocumentClient::getOrdre))
                .forEach(line -> addInvoiceLine(table, line, bold, fleetAnnexes.get(line)));
        document.add(table);
    }

    private void addInvoiceLine(
            Table table,
            LigneDocumentClient line,
            PdfFont bold,
            Integer fleetAnnexNumber
    ) {
        addValue(table, statementReference(line), TextAlignment.CENTER, null);
        addValue(table, date(line.getDateOperation()), TextAlignment.CENTER, null);
        addValue(table, date(line.getDateEcheance()), TextAlignment.CENTER, null);
        addValue(table, lineLabelService.label(line, fleetAnnexNumber), TextAlignment.LEFT, null);
        addValue(table, amount(line.getPrimeNette()), TextAlignment.CENTER, null);
        addValue(table, amount(line.getTaxes()), TextAlignment.CENTER, null);
        addValue(table, amount(line.getAccessoires()), TextAlignment.CENTER, null);
        addValue(table, amount(line.getMontantTtc()), TextAlignment.CENTER, bold);
    }

    private void addStatementLine(
            Table table,
            DocumentClient source,
            LigneDocumentClient line,
            PdfFont bold,
            Integer fleetAnnexNumber,
            Map<Long, String> subscriberNames
    ) {
        BigDecimal balance = money(line.getDebit()).subtract(money(line.getCredit()));
        Contrat contract = contract(line);
        String subscriberName = contract == null ? null : subscriberNames.get(contract.getId());
        String insuredName = subscriberName == null || subscriberName.isBlank()
                ? source.getPayeurNom()
                : subscriberName;
        addValue(table, insuredName, TextAlignment.LEFT, null);
        addValue(table, statementReference(line), TextAlignment.CENTER, null);
        addValue(table, date(line.getDateOperation()), TextAlignment.CENTER, null);
        addValue(table, date(line.getDateEcheance()), TextAlignment.CENTER, null);
        addValue(table, amount(line.getPrimeNette()), TextAlignment.CENTER, null);
        addValue(table, amount(line.getTaxes()), TextAlignment.CENTER, null);
        addValue(table, amount(line.getMontantTtc()), TextAlignment.CENTER, null);
        addValue(table, positiveAmount(line.getCredit()), TextAlignment.CENTER, null);
        addValue(table, amount(balance), TextAlignment.CENTER, bold);
        addValue(table, lineLabelService.label(line, fleetAnnexNumber), TextAlignment.LEFT, null);
    }

    private Map<Long, String> subscriberNames(DocumentClient source) {
        Set<Long> contractIds = source.getLignes().stream()
                .map(this::contract)
                .filter(java.util.Objects::nonNull)
                .map(Contrat::getId)
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toSet());
        if (contractIds.isEmpty()) {
            return Map.of();
        }

        Map<Long, ContratClient> subscribers = new HashMap<>();
        for (ContratClient link : contratClientRepository.findByContratIdInAndRole(
                contractIds,
                RoleClientContrat.SOUSCRIPTEUR
        )) {
            Long contractId = link.getContrat().getId();
            ContratClient current = subscribers.get(contractId);
            if (current == null || Boolean.TRUE.equals(link.getPrincipalPourRole())) {
                subscribers.put(contractId, link);
            }
        }
        return subscribers.entrySet().stream()
                .filter(entry -> entry.getValue().getClient() != null)
                .collect(Collectors.toMap(
                        Map.Entry::getKey,
                        entry -> value(entry.getValue().getClient().getNomAffichage())
                ));
    }

    private Contrat contract(LigneDocumentClient line) {
        return line.getElementFacturable() == null ? null : line.getElementFacturable().getContrat();
    }

    private Map<LigneDocumentClient, Integer> fleetAnnexes(DocumentClient source) {
        Map<LigneDocumentClient, Integer> annexes = new LinkedHashMap<>();
        source.getLignes().stream()
                .sorted(Comparator.comparing(LigneDocumentClient::getOrdre))
                .filter(this::isFleetInsuranceLine)
                .forEach(line -> annexes.put(line, annexes.size() + 1));
        return annexes;
    }

    private boolean isFleetInsuranceLine(LigneDocumentClient line) {
        return line.getElementFacturable() != null
                && line.getElementFacturable().getNature() != NatureElementFacturable.ASSISTANCE
                && line.getElementFacturable().getContrat() != null
                && line.getElementFacturable().getContrat().getTypeContrat() == TypeContrat.FLOTTE;
    }

    private void writeFleetAnnexes(
            Document document,
            DocumentClient source,
            Map<LigneDocumentClient, Integer> fleetAnnexes
    ) {
        fleetAnnexes.forEach((line, annexNumber) -> {
            Long contractId = line.getElementFacturable().getContrat().getId();
            Long movementId = movementId(line);
            try {
                flottePolicePdfService.appendClientDocumentAnnex(
                        document,
                        source.getAgence().getId(),
                        contractId,
                        movementId,
                        annexNumber
                );
            } catch (Exception exception) {
                log.error(
                        "Failed to render fleet annex {} for client document {}, contract {}, movement {}",
                        annexNumber,
                        source.getId(),
                        contractId,
                        movementId,
                        exception
                );
                throw new BadRequestException(annexError(line, annexNumber, movementId));
            }
        });
    }

    private String annexError(LigneDocumentClient line, int annexNumber, Long movementId) {
        String police = value(line.getNumeroPolice());
        String movement = movementId == null ? "non rattaché" : String.valueOf(movementId);
        return "La génération de l'annexe " + annexNumber + " (police " + police
                + ", mouvement " + movement + ") a échoué";
    }

    private Long movementId(LigneDocumentClient line) {
        if (line.getQuittance() != null && line.getQuittance().getMouvementContrat() != null) {
            return line.getQuittance().getMouvementContrat().getId();
        }
        if (line.getElementFacturable() != null
                && line.getElementFacturable().getMouvementContrat() != null) {
            return line.getElementFacturable().getMouvementContrat().getId();
        }
        return null;
    }

    private String statementReference(LigneDocumentClient line) {
        if (line.getElementFacturable() != null
                && line.getElementFacturable().getNature() == NatureElementFacturable.ASSISTANCE) {
            return value(line.getNumeroQuittance());
        }
        return value(line.getNumeroPolice());
    }

    private void addHeader(Table table, String text, PdfFont font) {
        table.addHeaderCell(new Cell()
                .add(new Paragraph(text).setFont(font).setFontSize(7.5f).setMargin(0))
                .setFontColor(ColorConstants.WHITE)
                .setBackgroundColor(TABLE_HEADER_BLUE)
                .setTextAlignment(TextAlignment.CENTER)
                .setVerticalAlignment(VerticalAlignment.MIDDLE)
                .setBorder(new SolidBorder(ColorConstants.WHITE, 0.35f))
                .setPadding(4f));
    }

    private void addValue(Table table, String text, TextAlignment alignment, PdfFont font) {
        Paragraph paragraph = new Paragraph(value(text)).setFontSize(7.5f).setMargin(0);
        if (font != null) {
            paragraph.setFont(font);
        }
        table.addCell(new Cell()
                .add(paragraph)
                .setTextAlignment(alignment)
                .setVerticalAlignment(VerticalAlignment.MIDDLE)
                .setBorder(BODY_BORDER)
                .setPadding(4f));
    }

    private void writeTotal(Document document, DocumentClient source, PdfFont bold) {
        Table total = new Table(new float[]{1.55f, 1})
                .setWidth(UnitValue.createPercentValue(27))
                .setHorizontalAlignment(HorizontalAlignment.RIGHT)
                .setMarginRight(0)
                .setMarginTop(10);
        total.addCell(new Cell()
                .add(new Paragraph(isInvoice(source) ? "Total TTC" : "Total")
                        .setFont(bold)
                        .setFontSize(8.5f)
                        .setFontColor(ColorConstants.WHITE)
                        .setMargin(0))
                .setTextAlignment(TextAlignment.CENTER)
                .setBorder(TABLE_BORDER)
                .setBackgroundColor(TABLE_HEADER_BLUE)
                .setPadding(4));
        total.addCell(new Cell()
                .add(new Paragraph(amount(source.getTotalDocument())).setFont(bold).setFontSize(8.5f).setMargin(0))
                .setTextAlignment(TextAlignment.RIGHT)
                .setBorder(TABLE_BORDER)
                .setBackgroundColor(LIGHT_BLUE)
                .setFontColor(BRAND_BLUE)
                .setPadding(4));
        document.add(total);
    }

    private void writePaymentText(Document document, DocumentClient source, PdfFont bold, PdfFont italic) {
        if (isInvoice(source)) {
            writeInvoiceClosing(document, source, bold, italic);
            return;
        }
        document.add(new Paragraph("Le montant total à régler s'élève à "
                + amount(source.getTotalDocument()) + " Dhs")
                .setFontSize(9.5f)
                .setFontColor(BRAND_BLUE)
                .setMarginLeft(0)
                .setMarginTop(18)
                .setMarginBottom(3));
        document.add(new Paragraph(
                "Dès réception de votre règlement, nous vous ferons parvenir la (les) quittance(s) correspondante(s)."
        )
                .setFontSize(9.5f)
                .setMarginLeft(0)
                .setMarginTop(0));
    }

    private void writeInvoiceClosing(Document document, DocumentClient source, PdfFont bold, PdfFont italic) {
        Table heading = new Table(new float[]{3.6f, 0.9f, 1.05f})
                .setWidth(UnitValue.createPercentValue(100));
        heading.addCell(new Cell()
                .add(new Paragraph("ARRÊTÉE LA PRÉSENTE FACTURE À LA SOMME DE :")
                        .setFont(bold)
                        .setFontSize(8.5f)
                        .setFontColor(BRAND_BLUE)
                        .setMargin(0))
                .setVerticalAlignment(VerticalAlignment.MIDDLE)
                .setBorder(Border.NO_BORDER)
                .setPadding(6));
        heading.addCell(new Cell()
                .add(new Paragraph("Total TTC :")
                        .setFont(bold)
                        .setFontSize(8.5f)
                        .setFontColor(ColorConstants.WHITE)
                        .setTextAlignment(TextAlignment.CENTER)
                        .setMargin(0))
                .setVerticalAlignment(VerticalAlignment.MIDDLE)
                .setBackgroundColor(TABLE_HEADER_BLUE)
                .setBorder(TABLE_BORDER)
                .setPadding(6));
        heading.addCell(new Cell()
                .add(new Paragraph(amount(source.getTotalDocument()))
                        .setFont(bold)
                        .setFontSize(8.5f)
                        .setFontColor(BRAND_BLUE)
                        .setTextAlignment(TextAlignment.CENTER)
                        .setMargin(0))
                .setVerticalAlignment(VerticalAlignment.MIDDLE)
                .setBackgroundColor(LIGHT_BLUE)
                .setBorder(TABLE_BORDER)
                .setPadding(6));

        Cell content = new Cell()
                .add(heading)
                .add(new Paragraph(amountInWords(source.getTotalDocument()))
                        .setFont(bold)
                        .setFontSize(9f)
                        .setMargins(13, 10, 13, 10))
                .setBorder(Border.NO_BORDER)
                .setPadding(0);
        content.setNextRenderer(new RoundedCellRenderer(content, 8f));
        Table closing = new Table(new float[]{1})
                .setWidth(UnitValue.createPercentValue(94))
                .setHorizontalAlignment(HorizontalAlignment.CENTER)
                .setKeepTogether(true)
                .setMarginTop(12);
        closing.addCell(content);
        document.add(closing);

        Paragraph issuer = new Paragraph()
                .setFontColor(BRAND_BLUE)
                .setTextAlignment(TextAlignment.RIGHT)
                .setMarginTop(28)
                .setMarginBottom(0);
        issuer.add(new com.itextpdf.layout.element.Text(
                value(source.getAgence().getNom()).toUpperCase(Locale.FRENCH))
                .setFont(bold)
                .setFontSize(8.25f));
        String agencyCity = city(source.getAgence());
        issuer.add(new com.itextpdf.layout.element.Text("\n"
                + (agencyCity.isBlank() ? "" : agencyCity + ", ")
                + "le " + LONG_DATE_FORMAT.format(source.getDateEmission()))
                .setFont(italic)
                .setFontSize(8f));
        document.add(issuer);
    }

    private String amountInWords(BigDecimal value) {
        BigDecimal normalized = money(value).setScale(2, RoundingMode.HALF_UP).abs();
        long dirhams = normalized.longValue();
        int centimes = normalized.remainder(BigDecimal.ONE).movePointRight(2).intValue();
        String sign = money(value).signum() < 0 ? "moins " : "";
        return (sign + numberInWords(dirhams) + " dirhams et "
                + numberInWords(centimes) + " centimes").toUpperCase(Locale.FRENCH);
    }

    private String numberInWords(long value) {
        if (value < 0 || value > 999_999_999_999L) {
            return Long.toString(value);
        }
        if (value < 1000) {
            return underThousand((int) value);
        }
        long unit;
        String singular;
        String plural;
        if (value >= 1_000_000_000L) {
            unit = 1_000_000_000L;
            singular = "milliard";
            plural = "milliards";
        } else if (value >= 1_000_000L) {
            unit = 1_000_000L;
            singular = "million";
            plural = "millions";
        } else {
            unit = 1000L;
            singular = "mille";
            plural = "mille";
        }
        long count = value / unit;
        long remainder = value % unit;
        String prefix = unit == 1000L && count == 1 ? "" : numberInWords(count) + " ";
        String result = prefix + (count > 1 ? plural : singular);
        return remainder == 0 ? result : result + " " + numberInWords(remainder);
    }

    private String underThousand(int value) {
        if (value < 100) {
            return underHundred(value);
        }
        int hundreds = value / 100;
        int remainder = value % 100;
        String prefix = hundreds == 1 ? "cent" : SMALL_NUMBERS[hundreds] + " cent";
        if (remainder == 0) {
            return hundreds > 1 ? prefix + "s" : prefix;
        }
        return prefix + " " + underHundred(remainder);
    }

    private String underHundred(int value) {
        if (value <= 16) {
            return SMALL_NUMBERS[value];
        }
        if (value < 20) {
            return "dix-" + SMALL_NUMBERS[value - 10];
        }
        if (value < 70) {
            int tens = value / 10;
            int units = value % 10;
            if (units == 0) {
                return TENS[tens];
            }
            return TENS[tens] + (units == 1 ? " et " : "-") + SMALL_NUMBERS[units];
        }
        if (value < 80) {
            int remainder = value - 60;
            return "soixante" + (remainder == 11 ? " et " : "-") + underHundred(remainder);
        }
        int remainder = value - 80;
        if (remainder == 0) {
            return "quatre-vingts";
        }
        return "quatre-vingt-" + underHundred(remainder);
    }

    private boolean isInvoice(DocumentClient source) {
        return source.getTypeDocument() == TypeDocumentClient.FACTURE;
    }

    private void writeNotes(Document document, DocumentClient source, PdfFont bold) {
        if (source.getNotes() == null || source.getNotes().isBlank()) {
            return;
        }
        document.add(new Paragraph("Notes")
                .setFont(bold)
                .setFontSize(8.5f)
                .setMarginLeft(7)
                .setMarginTop(12)
                .setMarginBottom(3));
        document.add(new Paragraph(source.getNotes().trim())
                .setFontSize(8.5f)
                .setBorder(TABLE_BORDER)
                .setPadding(6)
                .setMarginLeft(7)
                .setMarginRight(7)
                .setMarginTop(0));
    }

    private void writeSignature(Document document, Agence agence, boolean invoice) {
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
                .setMarginRight(invoice ? 0 : 30)
                .setMarginTop(invoice ? 3 : 8);
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

    private void writeReplacement(Document document, DocumentClient source, PdfFont bold) {
        String replacement = source.getDocumentRemplacement() == null
                ? ""
                : " - remplacé par " + source.getDocumentRemplacement().getNumero();
        document.add(new Paragraph("DOCUMENT REMPLACÉ" + replacement)
                .setFont(bold)
                .setFontColor(new DeviceRgb(37, 99, 235))
                .setTextAlignment(TextAlignment.CENTER)
                .setMarginTop(12));
    }

    private void writeFooter(
            PdfDocumentEvent event,
            DocumentClient source,
            PdfFont regular,
            PdfFont bold
    ) {
        Agence agency = source.getAgence();
        PdfDocument pdf = event.getDocument();
        PdfPage page = event.getPage();
        Rectangle pageSize = page.getPageSize();
        PdfCanvas pdfCanvas = new PdfCanvas(page.newContentStreamAfter(), page.getResources(), pdf);
        pdfCanvas.setStrokeColor(ACCENT_BLUE)
                .setLineWidth(0.65f)
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
            canvas.add(footerParagraph(bank, bold));
        }
        canvas.close();
    }

    private Paragraph footerParagraph(String text, PdfFont regular) {
        return new Paragraph(text)
                .setFont(regular)
                .setFontSize(6.9f)
                .setFontColor(BRAND_BLUE)
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
        append(result, "RIB : ", agency.getRib());
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

    private String payerIce(DocumentClient source) {
        if (source.getPayeurIce() != null && !source.getPayeurIce().isBlank()) {
            return source.getPayeurIce().trim();
        }
        if (source.getClientPayeur() == null
                || source.getClientPayeur().getIce() == null
                || source.getClientPayeur().getIce().isBlank()) {
            return null;
        }
        return source.getClientPayeur().getIce().trim();
    }

    private static final class RoundedCellRenderer extends CellRenderer {

        private static final float LINE_WIDTH = 0.65f;
        private final float radius;

        private RoundedCellRenderer(Cell modelElement, float radius) {
            super(modelElement);
            this.radius = radius;
        }

        @Override
        public IRenderer getNextRenderer() {
            return new RoundedCellRenderer((Cell) modelElement, radius);
        }

        @Override
        public void draw(DrawContext drawContext) {
            Rectangle box = getOccupiedAreaBBox();
            PdfCanvas canvas = drawContext.getCanvas();
            canvas.saveState()
                    .roundRectangle(box.getX(), box.getY(), box.getWidth(), box.getHeight(), radius)
                    .clip()
                    .newPath();
            super.draw(drawContext);
            canvas.restoreState();

            float inset = LINE_WIDTH / 2;
            canvas.saveState()
                    .setStrokeColor(BRAND_BLUE)
                    .setLineWidth(LINE_WIDTH)
                    .roundRectangle(
                            box.getX() + inset,
                            box.getY() + inset,
                            box.getWidth() - LINE_WIDTH,
                            box.getHeight() - LINE_WIDTH,
                            radius
                    )
                    .stroke()
                    .restoreState();
        }
    }

    private Cell borderless(Cell cell) {
        return cell.setBorder(Border.NO_BORDER).setPadding(0);
    }
}
