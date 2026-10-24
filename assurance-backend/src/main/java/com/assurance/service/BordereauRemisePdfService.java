package com.assurance.service;

import com.assurance.entity.Agence;
import com.assurance.entity.BordereauRemise;
import com.assurance.entity.CompteTresorerie;
import com.assurance.entity.InstrumentReglementClient;
import com.assurance.entity.LigneBordereauRemise;
import com.assurance.entity.LigneBordereauEspeces;
import com.assurance.enums.StatutBordereauRemise;
import com.assurance.enums.TypeBordereauRemise;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.BordereauRemiseRepository;
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
import com.itextpdf.layout.Canvas;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.borders.Border;
import com.itextpdf.layout.borders.SolidBorder;
import com.itextpdf.layout.element.Cell;
import com.itextpdf.layout.element.Image;
import com.itextpdf.layout.element.Paragraph;
import com.itextpdf.layout.element.Table;
import com.itextpdf.layout.element.Text;
import com.itextpdf.layout.property.HorizontalAlignment;
import com.itextpdf.layout.property.TextAlignment;
import com.itextpdf.layout.property.UnitValue;
import com.itextpdf.layout.property.VerticalAlignment;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class BordereauRemisePdfService {

    private static final DeviceRgb INK = new DeviceRgb(17, 48, 78);
    private static final DeviceRgb ACCENT = new DeviceRgb(17, 48, 78);
    private static final DeviceRgb TABLE_HEADER = new DeviceRgb(35, 78, 116);
    private static final DeviceRgb FOOTER_ACCENT = new DeviceRgb(0, 147, 211);
    private static final DeviceRgb SOFT_ACCENT = new DeviceRgb(232, 244, 250);
    private static final DeviceRgb SOFT_BLUE = new DeviceRgb(248, 250, 252);
    private static final DeviceRgb BORDER = new DeviceRgb(157, 171, 184);
    private static final DeviceRgb MUTED = new DeviceRgb(71, 85, 105);
    private static final DeviceRgb SUCCESS = new DeviceRgb(5, 150, 105);
    private static final float PAGE_MARGIN = 24f;
    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final BordereauRemiseRepository bordereauRepository;
    private final AgencyLogoStorageService agencyLogoStorageService;

    @Transactional(readOnly = true)
    public byte[] generate(Long agenceId, Long bordereauId) {
        BordereauRemise slip = bordereauRepository.findByIdAndAgenceId(bordereauId, agenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Bordereau de remise", bordereauId));
        try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            PdfDocument pdf = new PdfDocument(new PdfWriter(output));
            Document document = new Document(pdf, PageSize.A5.rotate());
            document.setMargins(20, PAGE_MARGIN, 34, PAGE_MARGIN);
            PdfFont regular = PdfFontFactory.createFont(StandardFonts.HELVETICA);
            PdfFont bold = PdfFontFactory.createFont(StandardFonts.HELVETICA_BOLD);
            document.setFont(regular).setFontSize(9).setFontColor(INK);

            writeHeader(document, slip, regular, bold);
            writeOverview(document, slip, regular, bold);
            if (slip.getType() == TypeBordereauRemise.VERSEMENT_ESPECES) {
                writeCashTransfer(document, slip, regular, bold);
            } else {
                writeInstrumentTable(document, slip, regular, bold);
            }
            writeNotes(document, slip, regular, bold);
            writeStateNotice(document, slip, bold);
            writeFooters(pdf, slip, regular);

            document.close();
            return output.toByteArray();
        } catch (Exception exception) {
            log.error("Failed to generate remittance slip PDF {}", bordereauId, exception);
            throw new BadRequestException("La génération du PDF du bordereau a échoué");
        }
    }

    private void writeHeader(Document document, BordereauRemise slip, PdfFont regular, PdfFont bold) {
        Table header = new Table(new float[]{1, 2.4f})
                .setWidth(UnitValue.createPercentValue(100));
        Cell identity = cell().setMinHeight(52).setVerticalAlignment(VerticalAlignment.MIDDLE);
        byte[] logo = agencyLogoStorageService.loadBytesIfPresent(slip.getAgence().getLogoCheminStockage());
        if (logo != null && logo.length > 0) {
            Image image = new Image(ImageDataFactory.create(logo));
            image.scaleToFit(150, 50);
            identity.add(image);
        } else {
            identity.add(new Paragraph(slip.getAgence().getNom()).setFont(bold).setFontSize(15));
        }
        header.addCell(identity);

        Cell title = cell().setTextAlignment(TextAlignment.RIGHT).setVerticalAlignment(VerticalAlignment.MIDDLE);
        title.add(new Paragraph(typeTitle(slip.getType()))
                .setFont(bold)
                .setFontSize(13)
                .setFontColor(INK)
                .setMargin(0));
        title.add(new Paragraph("Réf. interne : " + slip.getNumero())
                .setFont(bold)
                .setFontSize(10)
                .setFontColor(ACCENT)
                .setMarginTop(5)
                .setMarginBottom(0));
        title.add(new Paragraph(statusLabel(slip))
                .setFont(regular)
                .setFontSize(7.5f)
                .setFontColor(statusColor(slip))
                .setMarginTop(3)
                .setMarginBottom(0));
        if (slip.getReferenceBancaire() != null && !slip.getReferenceBancaire().isBlank()) {
            title.add(new Paragraph("Réf. banque : " + slip.getReferenceBancaire().trim())
                    .setFont(regular)
                    .setFontSize(7.5f)
                    .setFontColor(MUTED)
                    .setMarginTop(2)
                    .setMarginBottom(0));
        }
        header.addCell(title);
        document.add(header);
        document.add(new Paragraph("")
                .setBorderBottom(new SolidBorder(ACCENT, 1.4f))
                .setMarginTop(1)
                .setMarginBottom(9));
    }

    private void writeOverview(Document document, BordereauRemise slip, PdfFont regular, PdfFont bold) {
        Table overview = new Table(new float[]{1, 1, 1, 1.15f})
                .setWidth(UnitValue.createPercentValue(100))
                .setMarginBottom(4);
        overview.addCell(compactInfoCell("DATE DU BORDEREAU", date(slip.getDateBordereau()), regular, bold));
        overview.addCell(compactInfoCell("DATE DE REMISE",
                slip.getDateDepot() == null ? "À confirmer" : date(slip.getDateDepot()), regular, bold));
        overview.addCell(compactInfoCell("NOMBRE DE PIÈCES",
                slip.getType() == TypeBordereauRemise.VERSEMENT_ESPECES
                        ? "-" : String.valueOf(slip.getLignes().size()), regular, bold));
        overview.addCell(compactInfoCell("MONTANT TOTAL", amount(slip.getMontantTotal()) + " "
                + slip.getCompteDestination().getDevise(), bold, bold).setBackgroundColor(SOFT_ACCENT));
        document.add(overview);

        CompteTresorerie destination = slip.getCompteDestination();
        Table bank = new Table(new float[]{1.5f, 1.3f, 1.2f, 2.4f})
                .setWidth(UnitValue.createPercentValue(100))
                .setMarginBottom(8);
        bank.addCell(compactStackedInfoCell("REMETTANT", slip.getAgence().getNom(), regular, bold));
        bank.addCell(compactStackedInfoCell("COMPTE À CRÉDITER", destination.getLibelle(), regular, bold));
        bank.addCell(compactStackedInfoCell("BANQUE DESTINATAIRE", destination.getBanqueReference() == null
                ? null : destination.getBanqueReference().getLibelle(), regular, bold));
        bank.addCell(compactStackedInfoCell("RIB", formatRib(destination.getRib()), regular, bold));
        document.add(bank);
    }

    private void writeInstrumentTable(Document document, BordereauRemise slip, PdfFont regular, PdfFont bold) {
        document.add(new Paragraph(slip.getType() == TypeBordereauRemise.CHEQUE
                        ? "Détail des chèques remis" : "Détail des effets remis")
                .setFont(bold)
                .setFontSize(11)
                .setMarginBottom(5));
        Table table = new Table(new float[]{0.35f, 1.45f, 1.55f, 1.35f, 0.85f, 0.85f, 1f})
                .setWidth(UnitValue.createPercentValue(100));
        addHeader(table, "N°", bold, TextAlignment.CENTER);
        addHeader(table, slip.getType() == TypeBordereauRemise.CHEQUE
                ? "N° CHÈQUE" : "RÉF. EFFET", bold, TextAlignment.LEFT);
        addHeader(table, slip.getType() == TypeBordereauRemise.CHEQUE
                ? "TIREUR / PAYEUR" : "TIRÉ / PAYEUR", bold, TextAlignment.LEFT);
        addHeader(table, slip.getType() == TypeBordereauRemise.CHEQUE
                ? "BANQUE TIRÉE" : "BANQUE DOMICILIATAIRE", bold, TextAlignment.LEFT);
        addHeader(table, "REÇU LE", bold, TextAlignment.CENTER);
        addHeader(table, "ÉCHÉANCE", bold, TextAlignment.CENTER);
        addHeader(table, "MONTANT", bold, TextAlignment.RIGHT);

        int index = 1;
        for (LigneBordereauRemise line : slip.getLignes().stream()
                .sorted(Comparator.comparing(LigneBordereauRemise::getId))
                .toList()) {
            InstrumentReglementClient instrument = line.getInstrument();
            DeviceRgb background = index % 2 == 0 ? SOFT_BLUE : null;
            addBody(table, String.valueOf(index), regular, TextAlignment.CENTER, background);
            addBody(table, instrument.getReferenceInstrument(), bold, TextAlignment.LEFT, background);
            addBody(table, instrument.getReglement().getPayeurNom(), regular, TextAlignment.LEFT, background);
            addBody(table, value(instrument.getBanqueEmettriceReference() == null
                    ? null : instrument.getBanqueEmettriceReference().getLibelle()), regular, TextAlignment.LEFT, background);
            addBody(table, date(instrument.getDateInstrument()), regular, TextAlignment.CENTER, background);
            addBody(table, date(instrument.getDateEcheance()), regular, TextAlignment.CENTER, background);
            addBody(table, amount(line.getMontant()), bold, TextAlignment.RIGHT, background);
            index++;
        }
        document.add(table);

        Table total = new Table(new float[]{3.8f, 1.2f})
                .setWidth(UnitValue.createPercentValue(45))
                .setHorizontalAlignment(HorizontalAlignment.RIGHT)
                .setMarginTop(6);
        total.addCell(new Cell().add(new Paragraph("TOTAL À REMETTRE").setFont(bold).setFontSize(8))
                .setBorder(new SolidBorder(BORDER, 0.6f)).setBackgroundColor(SOFT_ACCENT).setPadding(6));
        total.addCell(new Cell().add(new Paragraph(amount(slip.getMontantTotal()) + " "
                        + slip.getCompteDestination().getDevise()).setFont(bold).setFontSize(10))
                .setBorder(new SolidBorder(BORDER, 0.6f)).setBackgroundColor(SOFT_ACCENT)
                .setTextAlignment(TextAlignment.RIGHT).setPadding(6));
        document.add(total);
    }

    private void writeCashTransfer(Document document, BordereauRemise slip, PdfFont regular, PdfFont bold) {
        document.add(new Paragraph("Journées de caisse versées")
                .setFont(bold)
                .setFontSize(11)
                .setMarginBottom(7));

        if (slip.getLignesEspeces().isEmpty()) {
            Table legacyTransfer = new Table(new float[]{1, 0.28f, 1})
                    .setWidth(UnitValue.createPercentValue(100));
            legacyTransfer.addCell(infoCell("CAISSE SOURCE", slip.getCompteSource() == null
                    ? "-" : slip.getCompteSource().getLibelle(), regular, bold).setMinHeight(60));
            legacyTransfer.addCell(cell().add(new Paragraph("VERS").setFont(bold).setFontSize(8)
                    .setTextAlignment(TextAlignment.CENTER)).setVerticalAlignment(VerticalAlignment.MIDDLE));
            legacyTransfer.addCell(infoCell("COMPTE BANCAIRE DESTINATAIRE",
                    slip.getCompteDestination().getLibelle(), regular, bold).setMinHeight(60));
            document.add(legacyTransfer);
        } else {
            Map<String, List<LigneBordereauEspeces>> byDay = slip.getLignesEspeces().stream()
                    .sorted(Comparator
                            .comparing((LigneBordereauEspeces line) ->
                                    line.getMouvementTresorerie().getDateOperation())
                            .thenComparing(line -> line.getMouvementTresorerie()
                                    .getCompteTresorerie().getLibelle()))
                    .collect(Collectors.groupingBy(
                            line -> line.getMouvementTresorerie().getCompteTresorerie().getId()
                                    + ":" + line.getMouvementTresorerie().getDateOperation(),
                            LinkedHashMap::new,
                            Collectors.toList()
                    ));
            Table days = new Table(new float[]{1.1f, 2.2f, 2.1f, 0.8f, 1.2f})
                    .setWidth(UnitValue.createPercentValue(100));
            addHeader(days, "DATE", bold, TextAlignment.LEFT);
            addHeader(days, "CAISSE", bold, TextAlignment.LEFT);
            addHeader(days, "CAISSIER", bold, TextAlignment.LEFT);
            addHeader(days, "ENCAISS.", bold, TextAlignment.CENTER);
            addHeader(days, "MONTANT", bold, TextAlignment.RIGHT);
            byDay.values().forEach(lines -> {
                LigneBordereauEspeces first = lines.get(0);
                CompteTresorerie source = first.getMouvementTresorerie().getCompteTresorerie();
                BigDecimal dayTotal = lines.stream()
                        .map(LigneBordereauEspeces::getMontant)
                        .reduce(BigDecimal.ZERO, BigDecimal::add);
                addBody(days, date(first.getMouvementTresorerie().getDateOperation()), regular,
                        TextAlignment.LEFT, null);
                addBody(days, source.getLibelle(), regular, TextAlignment.LEFT, null);
                addBody(days, source.getUtilisateurTitulaire() == null
                        ? "-" : source.getUtilisateurTitulaire().getFullName(), regular,
                        TextAlignment.LEFT, null);
                addBody(days, String.valueOf(lines.size()), regular, TextAlignment.CENTER, null);
                addBody(days, amount(dayTotal), bold, TextAlignment.RIGHT, null);
            });
            document.add(days);
            document.add(new Paragraph("Destination : " + slip.getCompteDestination().getLibelle())
                    .setFont(regular).setFontSize(8.5f).setMarginTop(6));
        }

        Table amountTable = new Table(new float[]{1, 1})
                .setWidth(UnitValue.createPercentValue(55))
                .setHorizontalAlignment(HorizontalAlignment.RIGHT)
                .setMarginTop(10);
        amountTable.addCell(infoCell("MONTANT VERSÉ", amount(slip.getMontantTotal()) + " "
                + slip.getCompteDestination().getDevise(), regular, bold).setBackgroundColor(SOFT_ACCENT));
        amountTable.addCell(infoCell("DATE DE VALEUR", date(slip.getDateDepot()), regular, bold));
        document.add(amountTable);
    }

    private void writeNotes(Document document, BordereauRemise slip, PdfFont regular, PdfFont bold) {
        if (slip.getNotes() == null || slip.getNotes().isBlank()) {
            return;
        }
        Cell notes = new Cell()
                .setBorder(new SolidBorder(BORDER, 0.6f))
                .setPadding(9)
                .setBackgroundColor(SOFT_BLUE);
        notes.add(new Paragraph("NOTES").setFont(bold).setFontSize(7).setFontColor(MUTED).setMargin(0));
        notes.add(new Paragraph(slip.getNotes().trim()).setFont(regular).setFontSize(8.5f).setMarginTop(4));
        document.add(new Table(new float[]{1})
                .setWidth(UnitValue.createPercentValue(100))
                .setMarginTop(8)
                .addCell(notes));
    }

    private void writeStateNotice(Document document, BordereauRemise slip, PdfFont bold) {
        if (slip.getStatut() == StatutBordereauRemise.ANNULE) {
            document.add(new Paragraph("BORDEREAU ANNULÉ")
                    .setFont(bold).setFontSize(12).setFontColor(ColorConstants.RED)
                    .setTextAlignment(TextAlignment.CENTER).setMarginTop(8));
        }
    }

    private void writeFooters(PdfDocument pdf, BordereauRemise slip, PdfFont regular) {
        int pageCount = pdf.getNumberOfPages();
        for (int pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
            writeFooter(pdf, pdf.getPage(pageNumber), slip, regular, pageNumber, pageCount);
        }
    }

    private void writeFooter(
            PdfDocument pdf,
            PdfPage page,
            BordereauRemise slip,
            PdfFont regular,
            int pageNumber,
            int pageCount
    ) {
        Rectangle pageSize = page.getPageSize();
        PdfCanvas canvas = new PdfCanvas(page.newContentStreamAfter(), page.getResources(), pdf);
        canvas.setStrokeColor(FOOTER_ACCENT).setLineWidth(0.5f)
                .moveTo(PAGE_MARGIN, 28).lineTo(pageSize.getWidth() - PAGE_MARGIN, 28).stroke();
        Canvas footer = new Canvas(canvas, pdf, new Rectangle(
                PAGE_MARGIN, 5, pageSize.getWidth() - PAGE_MARGIN * 2, 20));
        footer.add(new Paragraph(agencyLine(slip.getAgence()))
                .setFont(regular).setFontSize(6.4f).setFontColor(MUTED)
                .setTextAlignment(TextAlignment.CENTER).setMargin(0).setMultipliedLeading(1));
        if (pageCount > 1) {
            footer.add(new Paragraph("Page " + pageNumber + " / " + pageCount)
                    .setFont(regular).setFontSize(6.4f).setFontColor(MUTED)
                    .setTextAlignment(TextAlignment.CENTER).setMargin(0));
        }
        footer.close();
    }

    private Cell infoCell(String label, String content, PdfFont regular, PdfFont bold) {
        Cell cell = new Cell().setBorder(new SolidBorder(BORDER, 0.6f)).setPadding(6);
        cell.add(new Paragraph(label).setFont(bold).setFontSize(6.8f).setFontColor(MUTED).setMargin(0));
        cell.add(new Paragraph(value(content)).setFont(regular).setFontSize(9)
                .setFontColor(INK).setMarginTop(4).setMarginBottom(0));
        return cell;
    }

    private Cell compactInfoCell(String label, String content, PdfFont valueFont, PdfFont bold) {
        Paragraph line = new Paragraph()
                .add(new Text(label + " :  ").setFont(bold).setFontSize(6.2f).setFontColor(MUTED))
                .add(new Text(value(content)).setFont(valueFont).setFontSize(7.2f).setFontColor(INK))
                .setMargin(0)
                .setMultipliedLeading(1);
        return new Cell()
                .add(line)
                .setBorder(new SolidBorder(BORDER, 0.6f))
                .setVerticalAlignment(VerticalAlignment.MIDDLE)
                .setPadding(5);
    }

    private Cell compactStackedInfoCell(String label, String content, PdfFont regular, PdfFont bold) {
        return new Cell()
                .add(new Paragraph(label)
                        .setFont(bold)
                        .setFontSize(6.2f)
                        .setFontColor(MUTED)
                        .setMargin(0)
                        .setMultipliedLeading(1))
                .add(new Paragraph(value(content))
                        .setFont(regular)
                        .setFontSize(7.2f)
                        .setFontColor(INK)
                        .setMarginTop(1)
                        .setMarginBottom(0)
                        .setMultipliedLeading(1))
                .setBorder(new SolidBorder(BORDER, 0.6f))
                .setVerticalAlignment(VerticalAlignment.MIDDLE)
                .setPadding(4);
    }

    private void addHeader(Table table, String text, PdfFont bold, TextAlignment alignment) {
        table.addHeaderCell(new Cell().add(new Paragraph(text).setFont(bold).setFontSize(6.5f).setMargin(0))
                .setBackgroundColor(TABLE_HEADER).setFontColor(ColorConstants.WHITE)
                .setTextAlignment(alignment).setVerticalAlignment(VerticalAlignment.MIDDLE)
                .setBorder(new SolidBorder(TABLE_HEADER, 0.5f)).setPadding(6));
    }

    private void addBody(
            Table table,
            String text,
            PdfFont font,
            TextAlignment alignment,
            DeviceRgb background
    ) {
        Cell cell = new Cell().add(new Paragraph(value(text)).setFont(font).setFontSize(7).setMargin(0))
                .setTextAlignment(alignment).setVerticalAlignment(VerticalAlignment.MIDDLE)
                .setBorder(new SolidBorder(BORDER, 0.45f)).setPadding(5);
        if (background != null) {
            cell.setBackgroundColor(background);
        }
        table.addCell(cell);
    }

    private Cell cell() {
        return new Cell().setBorder(Border.NO_BORDER).setPadding(0);
    }

    private String typeTitle(TypeBordereauRemise type) {
        return switch (type) {
            case CHEQUE -> "BORDEREAU DE REMISE DE CHÈQUES";
            case EFFET -> "BORDEREAU DE REMISE D’EFFETS";
            case VERSEMENT_ESPECES -> "BORDEREAU DE VERSEMENT D’ESPÈCES";
        };
    }

    private String statusLabel(BordereauRemise slip) {
        if (slip.getType() != TypeBordereauRemise.VERSEMENT_ESPECES
                && (slip.getStatut() == StatutBordereauRemise.PARTIELLEMENT_TRAITE
                || slip.getStatut() == StatutBordereauRemise.CLOTURE)) {
            return "REMIS À LA BANQUE";
        }
        return switch (slip.getStatut()) {
            case BROUILLON -> "PROVISOIRE";
            case DEPOSE -> "REMIS À LA BANQUE";
            case PARTIELLEMENT_TRAITE -> "PARTIELLEMENT TRAITÉ";
            case CLOTURE -> "CLÔTURÉ";
            case ANNULE -> "ANNULÉ";
        };
    }

    private DeviceRgb statusColor(BordereauRemise slip) {
        if (slip.getType() != TypeBordereauRemise.VERSEMENT_ESPECES
                && (slip.getStatut() == StatutBordereauRemise.PARTIELLEMENT_TRAITE
                || slip.getStatut() == StatutBordereauRemise.CLOTURE)) {
            return new DeviceRgb(37, 99, 235);
        }
        return switch (slip.getStatut()) {
            case CLOTURE -> SUCCESS;
            case ANNULE -> new DeviceRgb(220, 38, 38);
            case BROUILLON -> MUTED;
            default -> new DeviceRgb(37, 99, 235);
        };
    }

    private String agencyLine(Agence agency) {
        String address = joinAvailable(agency.getAdresse(), agency.getVille());
        String contact = joinAvailable(agency.getTelephone(), agency.getEmail());
        return joinAvailable(joinAvailable(agency.getNom(), address), contact);
    }

    private String date(LocalDate date) {
        return date == null ? "-" : DATE_FORMAT.format(date);
    }

    private String amount(BigDecimal amount) {
        DecimalFormatSymbols symbols = DecimalFormatSymbols.getInstance(Locale.FRANCE);
        String formatted = new DecimalFormat("#,##0.00", symbols)
                .format(amount == null ? BigDecimal.ZERO : amount);
        return formatted.replace('\u202f', ' ').replace('\u00a0', ' ');
    }

    private String value(String value) {
        return value == null || value.isBlank() ? "-" : value.trim();
    }

    private String formatRib(String rib) {
        if (rib == null || rib.isBlank()) {
            return "-";
        }
        String compact = rib.replaceAll("\\s+", "");
        if (compact.matches("\\d{24}")) {
            return compact.substring(0, 3) + " "
                    + compact.substring(3, 6) + " "
                    + compact.substring(6, 22) + " "
                    + compact.substring(22);
        }
        return rib.trim();
    }

    private String joinAvailable(String first, String second) {
        boolean firstPresent = first != null && !first.isBlank();
        boolean secondPresent = second != null && !second.isBlank();
        if (!firstPresent) {
            return secondPresent ? second.trim() : "";
        }
        return secondPresent ? first.trim() + " · " + second.trim() : first.trim();
    }
}
