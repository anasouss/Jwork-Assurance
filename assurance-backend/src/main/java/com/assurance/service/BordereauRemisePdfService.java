package com.assurance.service;

import com.assurance.entity.Agence;
import com.assurance.entity.BordereauRemise;
import com.assurance.entity.CompteTresorerie;
import com.assurance.entity.InstrumentReglementClient;
import com.assurance.entity.LigneBordereauRemise;
import com.assurance.enums.StatutBordereauRemise;
import com.assurance.enums.StatutLigneBordereauRemise;
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
import java.util.Locale;

@Service
@RequiredArgsConstructor
@Slf4j
public class BordereauRemisePdfService {

    private static final DeviceRgb INK = new DeviceRgb(20, 33, 48);
    private static final DeviceRgb ACCENT = new DeviceRgb(217, 119, 6);
    private static final DeviceRgb SOFT_ACCENT = new DeviceRgb(255, 247, 237);
    private static final DeviceRgb SOFT_BLUE = new DeviceRgb(241, 245, 249);
    private static final DeviceRgb BORDER = new DeviceRgb(203, 213, 225);
    private static final DeviceRgb MUTED = new DeviceRgb(71, 85, 105);
    private static final DeviceRgb SUCCESS = new DeviceRgb(5, 150, 105);
    private static final float PAGE_MARGIN = 30f;
    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final BordereauRemiseRepository bordereauRepository;
    private final AgencyLogoStorageService agencyLogoStorageService;

    @Transactional(readOnly = true)
    public byte[] generate(Long agenceId, Long bordereauId) {
        BordereauRemise slip = bordereauRepository.findByIdAndAgenceId(bordereauId, agenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Bordereau de remise", bordereauId));
        try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            PdfDocument pdf = new PdfDocument(new PdfWriter(output));
            Document document = new Document(pdf, PageSize.A4);
            document.setMargins(28, PAGE_MARGIN, 54, PAGE_MARGIN);
            PdfFont regular = PdfFontFactory.createFont(StandardFonts.HELVETICA);
            PdfFont bold = PdfFontFactory.createFont(StandardFonts.HELVETICA_BOLD);
            document.setFont(regular).setFontSize(9).setFontColor(INK);
            pdf.addEventHandler(com.itextpdf.kernel.events.PdfDocumentEvent.END_PAGE,
                    event -> writeFooter((com.itextpdf.kernel.events.PdfDocumentEvent) event, slip, regular));

            writeHeader(document, slip, regular, bold);
            writeOverview(document, slip, regular, bold);
            if (slip.getType() == TypeBordereauRemise.VERSEMENT_ESPECES) {
                writeCashTransfer(document, slip, regular, bold);
            } else {
                writeInstrumentTable(document, slip, regular, bold);
            }
            writeNotes(document, slip, regular, bold);
            writeSignatures(document, bold);
            writeStateNotice(document, slip, bold);

            document.close();
            return output.toByteArray();
        } catch (Exception exception) {
            log.error("Failed to generate remittance slip PDF {}", bordereauId, exception);
            throw new BadRequestException("La génération du PDF du bordereau a échoué");
        }
    }

    private void writeHeader(Document document, BordereauRemise slip, PdfFont regular, PdfFont bold) {
        Table header = new Table(new float[]{1.2f, 2.2f})
                .setWidth(UnitValue.createPercentValue(100));
        Cell identity = cell().setMinHeight(72).setVerticalAlignment(VerticalAlignment.MIDDLE);
        byte[] logo = agencyLogoStorageService.loadBytesIfPresent(slip.getAgence().getLogoCheminStockage());
        if (logo != null && logo.length > 0) {
            Image image = new Image(ImageDataFactory.create(logo));
            image.scaleToFit(180, 62);
            identity.add(image);
        } else {
            identity.add(new Paragraph(slip.getAgence().getNom()).setFont(bold).setFontSize(15));
        }
        header.addCell(identity);

        Cell title = cell().setTextAlignment(TextAlignment.RIGHT).setVerticalAlignment(VerticalAlignment.MIDDLE);
        title.add(new Paragraph(typeTitle(slip.getType()))
                .setFont(bold)
                .setFontSize(15)
                .setFontColor(INK)
                .setMargin(0));
        title.add(new Paragraph(slip.getNumero())
                .setFont(bold)
                .setFontSize(12)
                .setFontColor(ACCENT)
                .setMarginTop(5)
                .setMarginBottom(0));
        title.add(new Paragraph(statusLabel(slip.getStatut()))
                .setFont(regular)
                .setFontSize(8)
                .setFontColor(statusColor(slip.getStatut()))
                .setMarginTop(4)
                .setMarginBottom(0));
        header.addCell(title);
        document.add(header);
        document.add(new Paragraph("")
                .setBorderBottom(new SolidBorder(ACCENT, 1.4f))
                .setMarginTop(2)
                .setMarginBottom(14));
    }

    private void writeOverview(Document document, BordereauRemise slip, PdfFont regular, PdfFont bold) {
        Table overview = new Table(new float[]{1, 1, 1, 1})
                .setWidth(UnitValue.createPercentValue(100))
                .setMarginBottom(12);
        overview.addCell(infoCell("DATE DU BORDEREAU", date(slip.getDateBordereau()), regular, bold));
        overview.addCell(infoCell("DATE DE DÉPÔT", date(slip.getDateDepot()), regular, bold));
        overview.addCell(infoCell("NOMBRE D’INSTRUMENTS",
                slip.getType() == TypeBordereauRemise.VERSEMENT_ESPECES
                        ? "-" : String.valueOf(slip.getLignes().size()), regular, bold));
        overview.addCell(infoCell("MONTANT TOTAL", amount(slip.getMontantTotal()) + " "
                + slip.getCompteDestination().getDevise(), regular, bold).setBackgroundColor(SOFT_ACCENT));
        document.add(overview);

        CompteTresorerie destination = slip.getCompteDestination();
        Table bank = new Table(new float[]{1.35f, 1.35f, 1.3f})
                .setWidth(UnitValue.createPercentValue(100))
                .setMarginBottom(15);
        bank.addCell(infoCell("COMPTE DESTINATAIRE", destination.getLibelle(), regular, bold));
        bank.addCell(infoCell("BANQUE / RIB", join(destination.getNomBanque(), destination.getRib()), regular, bold));
        bank.addCell(infoCell("RÉFÉRENCE BANCAIRE", value(slip.getReferenceBancaire()), regular, bold));
        document.add(bank);
    }

    private void writeInstrumentTable(Document document, BordereauRemise slip, PdfFont regular, PdfFont bold) {
        document.add(new Paragraph(slip.getType() == TypeBordereauRemise.CHEQUE
                        ? "Détail des chèques remis" : "Détail des effets remis")
                .setFont(bold)
                .setFontSize(11)
                .setMarginBottom(7));
        Table table = new Table(new float[]{0.35f, 1.1f, 1.65f, 1.3f, 0.85f, 0.85f, 0.95f, 0.9f})
                .setWidth(UnitValue.createPercentValue(100));
        addHeader(table, "N°", bold, TextAlignment.CENTER);
        addHeader(table, "RÉFÉRENCE", bold, TextAlignment.LEFT);
        addHeader(table, "PAYEUR", bold, TextAlignment.LEFT);
        addHeader(table, "BANQUE ÉMETTRICE", bold, TextAlignment.LEFT);
        addHeader(table, "REÇU LE", bold, TextAlignment.CENTER);
        addHeader(table, "ÉCHÉANCE", bold, TextAlignment.CENTER);
        addHeader(table, "MONTANT", bold, TextAlignment.RIGHT);
        addHeader(table, "STATUT", bold, TextAlignment.LEFT);

        int index = 1;
        for (LigneBordereauRemise line : slip.getLignes().stream()
                .sorted(Comparator.comparing(LigneBordereauRemise::getId))
                .toList()) {
            InstrumentReglementClient instrument = line.getInstrument();
            DeviceRgb background = index % 2 == 0 ? SOFT_BLUE : null;
            String instrumentReference = value(instrument.getReferenceInstrument())
                    + "\nRèglement " + instrument.getReglement().getNumero();
            String lineStatus = lineStatusLabel(line.getStatut());
            if (line.getMotifRejet() != null && !line.getMotifRejet().isBlank()) {
                lineStatus += "\n" + line.getMotifRejet().trim();
            }
            addBody(table, String.valueOf(index), regular, TextAlignment.CENTER, background);
            addBody(table, instrumentReference, bold, TextAlignment.LEFT, background);
            addBody(table, instrument.getReglement().getPayeurNom(), regular, TextAlignment.LEFT, background);
            addBody(table, value(instrument.getBanqueEmettrice()), regular, TextAlignment.LEFT, background);
            addBody(table, date(instrument.getDateInstrument()), regular, TextAlignment.CENTER, background);
            addBody(table, date(instrument.getDateEcheance()), regular, TextAlignment.CENTER, background);
            addBody(table, amount(line.getMontant()), bold, TextAlignment.RIGHT, background);
            addBody(table, lineStatus, regular, TextAlignment.LEFT, background);
            index++;
        }
        document.add(table);

        Table total = new Table(new float[]{3.8f, 1.2f})
                .setWidth(UnitValue.createPercentValue(45))
                .setHorizontalAlignment(HorizontalAlignment.RIGHT)
                .setMarginTop(8);
        total.addCell(new Cell().add(new Paragraph("TOTAL À REMETTRE").setFont(bold).setFontSize(8))
                .setBorder(new SolidBorder(BORDER, 0.6f)).setBackgroundColor(SOFT_ACCENT).setPadding(7));
        total.addCell(new Cell().add(new Paragraph(amount(slip.getMontantTotal()) + " "
                        + slip.getCompteDestination().getDevise()).setFont(bold).setFontSize(10))
                .setBorder(new SolidBorder(BORDER, 0.6f)).setBackgroundColor(SOFT_ACCENT)
                .setTextAlignment(TextAlignment.RIGHT).setPadding(7));
        document.add(total);
    }

    private void writeCashTransfer(Document document, BordereauRemise slip, PdfFont regular, PdfFont bold) {
        document.add(new Paragraph("Détail du versement")
                .setFont(bold)
                .setFontSize(11)
                .setMarginBottom(7));
        Table transfer = new Table(new float[]{1, 0.28f, 1})
                .setWidth(UnitValue.createPercentValue(100));
        transfer.addCell(infoCell("CAISSE SOURCE", slip.getCompteSource() == null
                ? "-" : slip.getCompteSource().getLibelle(), regular, bold).setMinHeight(60));
        transfer.addCell(cell().add(new Paragraph("VERS").setFont(bold).setFontSize(8)
                .setTextAlignment(TextAlignment.CENTER)).setVerticalAlignment(VerticalAlignment.MIDDLE));
        transfer.addCell(infoCell("COMPTE BANCAIRE DESTINATAIRE",
                slip.getCompteDestination().getLibelle(), regular, bold).setMinHeight(60));
        document.add(transfer);

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
                .setMarginTop(12)
                .addCell(notes));
    }

    private void writeSignatures(Document document, PdfFont bold) {
        Table signatures = new Table(new float[]{1, 1})
                .setWidth(UnitValue.createPercentValue(100))
                .setMarginTop(18);
        signatures.addCell(signatureCell("Cachet et signature de l’agence", bold));
        signatures.addCell(signatureCell("Visa de la banque", bold));
        document.add(signatures);
    }

    private void writeStateNotice(Document document, BordereauRemise slip, PdfFont bold) {
        if (slip.getStatut() == StatutBordereauRemise.ANNULE) {
            document.add(new Paragraph("BORDEREAU ANNULÉ")
                    .setFont(bold).setFontSize(12).setFontColor(ColorConstants.RED)
                    .setTextAlignment(TextAlignment.CENTER).setMarginTop(12));
        } else if (slip.getStatut() == StatutBordereauRemise.BROUILLON) {
            document.add(new Paragraph("BROUILLON - NON ENCORE DÉPOSÉ")
                    .setFont(bold).setFontSize(9).setFontColor(ACCENT)
                    .setTextAlignment(TextAlignment.CENTER).setMarginTop(12));
        }
    }

    private void writeFooter(
            com.itextpdf.kernel.events.PdfDocumentEvent event,
            BordereauRemise slip,
            PdfFont regular
    ) {
        PdfDocument pdf = event.getDocument();
        PdfPage page = event.getPage();
        Rectangle pageSize = page.getPageSize();
        PdfCanvas canvas = new PdfCanvas(page.newContentStreamAfter(), page.getResources(), pdf);
        canvas.setStrokeColor(ACCENT).setLineWidth(0.5f)
                .moveTo(PAGE_MARGIN, 38).lineTo(pageSize.getWidth() - PAGE_MARGIN, 38).stroke();
        Canvas footer = new Canvas(canvas, pdf, new Rectangle(
                PAGE_MARGIN, 14, pageSize.getWidth() - PAGE_MARGIN * 2, 18));
        footer.add(new Paragraph(agencyLine(slip.getAgence()) + "  ·  " + slip.getNumero()
                        + "  ·  Page " + pdf.getPageNumber(page))
                .setFont(regular).setFontSize(7).setFontColor(MUTED)
                .setTextAlignment(TextAlignment.CENTER).setMargin(0));
        footer.close();
    }

    private Cell infoCell(String label, String content, PdfFont regular, PdfFont bold) {
        Cell cell = new Cell().setBorder(new SolidBorder(BORDER, 0.6f)).setPadding(8);
        cell.add(new Paragraph(label).setFont(bold).setFontSize(6.8f).setFontColor(MUTED).setMargin(0));
        cell.add(new Paragraph(value(content)).setFont(regular).setFontSize(9)
                .setFontColor(INK).setMarginTop(4).setMarginBottom(0));
        return cell;
    }

    private Cell signatureCell(String label, PdfFont bold) {
        return new Cell().setMinHeight(72).setPadding(8).setBorder(new SolidBorder(BORDER, 0.6f))
                .add(new Paragraph(label).setFont(bold).setFontSize(8).setFontColor(MUTED));
    }

    private void addHeader(Table table, String text, PdfFont bold, TextAlignment alignment) {
        table.addHeaderCell(new Cell().add(new Paragraph(text).setFont(bold).setFontSize(6.5f).setMargin(0))
                .setBackgroundColor(INK).setFontColor(ColorConstants.WHITE)
                .setTextAlignment(alignment).setVerticalAlignment(VerticalAlignment.MIDDLE)
                .setBorder(new SolidBorder(INK, 0.5f)).setPadding(6));
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

    private String statusLabel(StatutBordereauRemise status) {
        return switch (status) {
            case BROUILLON -> "BROUILLON";
            case DEPOSE -> "DÉPOSÉ";
            case PARTIELLEMENT_TRAITE -> "PARTIELLEMENT TRAITÉ";
            case CLOTURE -> "CLÔTURÉ";
            case ANNULE -> "ANNULÉ";
        };
    }

    private DeviceRgb statusColor(StatutBordereauRemise status) {
        return switch (status) {
            case CLOTURE -> SUCCESS;
            case ANNULE -> new DeviceRgb(220, 38, 38);
            case BROUILLON -> ACCENT;
            default -> new DeviceRgb(37, 99, 235);
        };
    }

    private String lineStatusLabel(StatutLigneBordereauRemise status) {
        return switch (status) {
            case PREPAREE -> "Préparée";
            case REMISE -> "Remise";
            case ENCAISSEE -> "Encaissée";
            case REJETEE -> "Rejetée";
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

    private String join(String first, String second) {
        boolean firstPresent = first != null && !first.isBlank();
        boolean secondPresent = second != null && !second.isBlank();
        if (!firstPresent) {
            return secondPresent ? second.trim() : "-";
        }
        return secondPresent ? first.trim() + " · " + second.trim() : first.trim();
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
