package com.assurance.service;

import com.assurance.entity.AffectationReglementClient;
import com.assurance.entity.Agence;
import com.assurance.entity.Client;
import com.assurance.entity.Contrat;
import com.assurance.entity.DocumentClient;
import com.assurance.entity.ElementFacturable;
import com.assurance.entity.InstrumentReglementClient;
import com.assurance.entity.ReglementClient;
import com.assurance.enums.ModeReglementClient;
import com.assurance.enums.StatutAffectationReglement;
import com.assurance.enums.StatutInstrumentReglement;
import com.assurance.enums.StatutReglementClient;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.ReglementClientRepository;
import com.assurance.repository.InstrumentReglementClientRepository;
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
public class ReglementClientPdfService {

    private static final DeviceRgb INK = new DeviceRgb(17, 48, 78);
    private static final DeviceRgb ACCENT = new DeviceRgb(17, 48, 78);
    private static final DeviceRgb TABLE_HEADER = new DeviceRgb(35, 78, 116);
    private static final DeviceRgb FOOTER_ACCENT = new DeviceRgb(0, 147, 211);
    private static final DeviceRgb SOFT_ACCENT = new DeviceRgb(232, 244, 250);
    private static final DeviceRgb SOFT_BLUE = new DeviceRgb(248, 250, 252);
    private static final DeviceRgb BORDER = new DeviceRgb(157, 171, 184);
    private static final DeviceRgb MUTED = new DeviceRgb(71, 85, 105);
    private static final float PAGE_MARGIN = 24f;
    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final ReglementClientRepository reglementRepository;
    private final InstrumentReglementClientRepository instrumentRepository;
    private final AgencyLogoStorageService agencyLogoStorageService;

    @Transactional(readOnly = true)
    public byte[] generate(Long agenceId, Long reglementId) {
        ReglementClient payment = reglementRepository.findByIdAndAgenceId(reglementId, agenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Règlement client", reglementId));
        instrumentRepository.findByReglementIdAndAgenceIdOrderByIdAsc(
                reglementId,
                agenceId
        );
        try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            PdfDocument pdf = new PdfDocument(new PdfWriter(output));
            Document document = new Document(pdf, PageSize.A4);
            document.setMargins(22, PAGE_MARGIN, 72, PAGE_MARGIN);
            PdfFont regular = PdfFontFactory.createFont(StandardFonts.HELVETICA);
            PdfFont bold = PdfFontFactory.createFont(StandardFonts.HELVETICA_BOLD);
            document.setFont(regular).setFontSize(9).setFontColor(INK);
            pdf.addEventHandler(com.itextpdf.kernel.events.PdfDocumentEvent.END_PAGE,
                    event -> writeFooter(
                            (com.itextpdf.kernel.events.PdfDocumentEvent) event,
                            payment,
                            regular,
                            bold
                    ));

            writeHeader(document, payment, regular, bold);
            writeOverview(document, payment, regular, bold);
            writeInstruments(document, payment, regular, bold);
            writeAllocations(document, payment, regular, bold);
            writeNotes(document, payment, regular, bold);
            writeNotice(document, payment, regular, bold);
            writeSignatures(document, bold);

            document.close();
            return output.toByteArray();
        } catch (Exception exception) {
            log.error("Failed to generate client payment PDF {}", reglementId, exception);
            throw new BadRequestException("La génération du PDF du règlement a échoué");
        }
    }

    private void writeHeader(
            Document document,
            ReglementClient payment,
            PdfFont regular,
            PdfFont bold
    ) {
        Table header = new Table(new float[]{1.2f, 1.8f})
                .setWidth(UnitValue.createPercentValue(100))
                .setMarginBottom(4);
        Cell identity = cell().setVerticalAlignment(VerticalAlignment.MIDDLE);
        byte[] logo = agencyLogoStorageService.loadBytesIfPresent(payment.getAgence().getLogoCheminStockage());
        if (logo != null && logo.length > 0) {
            Image image = new Image(ImageDataFactory.create(logo));
            image.scaleToFit(180, 68);
            identity.add(image);
        } else {
            identity.add(new Paragraph(payment.getAgence().getNom()).setFont(bold).setFontSize(15));
        }
        header.addCell(identity);

        Cell title = cell().setTextAlignment(TextAlignment.RIGHT)
                .setVerticalAlignment(VerticalAlignment.MIDDLE);
        title.add(new Paragraph("FICHE DE RÈGLEMENT CLIENT")
                .setFont(bold).setFontSize(14).setFontColor(INK).setMargin(0));
        title.add(new Paragraph(payment.getNumero())
                .setFont(bold).setFontSize(10.5f).setFontColor(TABLE_HEADER)
                .setMarginTop(5).setMarginBottom(0));
        title.add(new Paragraph(paymentStatus(payment))
                .setFont(regular).setFontSize(8).setFontColor(MUTED)
                .setMarginTop(3).setMarginBottom(0));
        title.add(new Paragraph(city(payment.getAgence()) + " · " + DATE_FORMAT.format(payment.getDateReglement()))
                .setFont(regular).setFontSize(8).setFontColor(MUTED)
                .setMarginTop(3).setMarginBottom(0));
        header.addCell(title);
        document.add(header);
        document.add(new Paragraph("")
                .setBorderBottom(new SolidBorder(FOOTER_ACCENT, 0.8f))
                .setMarginTop(0).setMarginBottom(12));
    }

    private void writeOverview(Document document, ReglementClient payment, PdfFont regular, PdfFont bold) {
        Table overview = new Table(new float[]{1.7f, 0.8f, 1.1f, 1.1f})
                .setWidth(UnitValue.createPercentValue(100)).setMarginBottom(12);
        overview.addCell(infoCell("PAYEUR", payerIdentity(payment), regular, bold));
        overview.addCell(infoCell("DATE DU RÈGLEMENT", date(payment.getDateReglement()), regular, bold));
        overview.addCell(infoCell("STATUT", paymentStatus(payment), regular, bold));
        overview.addCell(infoCell("ENREGISTRÉ PAR",
                payment.getCreePar() == null ? null : payment.getCreePar().getFullName(), regular, bold));
        document.add(overview);

        Table totals = new Table(new float[]{1, 1})
                .setWidth(UnitValue.createPercentValue(55))
                .setHorizontalAlignment(HorizontalAlignment.RIGHT)
                .setMarginBottom(15);
        totals.addCell(totalLabelCell("Montant total", bold));
        totals.addCell(totalValueCell(amount(payment.getMontantTotal()) + " MAD", bold));
        totals.addCell(totalLabelCell("Non affecté", bold));
        totals.addCell(totalValueCell(amount(payment.getMontantNonAffecte()) + " MAD", bold));
        document.add(totals);
    }

    private void writeInstruments(Document document, ReglementClient payment, PdfFont regular, PdfFont bold) {
        document.add(sectionTitle("Moyens de paiement", bold));
        Table table = new Table(new float[]{0.9f, 0.8f, 0.8f, 1.1f, 1.35f, 0.9f, 0.85f})
                .setWidth(UnitValue.createPercentValue(100));
        addHeader(table, "MODE", bold, TextAlignment.LEFT);
        addHeader(table, "DATE", bold, TextAlignment.CENTER);
        addHeader(table, "ÉCHÉANCE", bold, TextAlignment.CENTER);
        addHeader(table, "RÉFÉRENCE", bold, TextAlignment.LEFT);
        addHeader(table, "BANQUE / COMPTE", bold, TextAlignment.LEFT);
        addHeader(table, "STATUT", bold, TextAlignment.LEFT);
        addHeader(table, "MONTANT", bold, TextAlignment.RIGHT);

        int index = 0;
        for (InstrumentReglementClient instrument : payment.getInstruments().stream()
                .sorted(Comparator.comparing(InstrumentReglementClient::getId))
                .toList()) {
            DeviceRgb background = index++ % 2 == 1 ? SOFT_BLUE : null;
            String bank = join(instrument.getBanqueEmettriceReference() == null
                            ? null : instrument.getBanqueEmettriceReference().getLibelle(),
                    instrument.getCompteTresorerie() == null
                            ? null : instrument.getCompteTresorerie().getLibelle());
            String status = instrumentStatus(instrument);
            if (instrument.getMotifStatut() != null && !instrument.getMotifStatut().isBlank()) {
                status += "\n" + instrument.getMotifStatut().trim();
            }
            addBody(table, modeLabel(instrument.getMode()), regular, TextAlignment.LEFT, background);
            addBody(table, date(instrument.getDateInstrument()), regular, TextAlignment.CENTER, background);
            addBody(table, date(instrument.getDateEcheance()), regular, TextAlignment.CENTER, background);
            addBody(table, value(instrument.getReferenceInstrument()), regular, TextAlignment.LEFT, background);
            addBody(table, bank, regular, TextAlignment.LEFT, background);
            addBody(table, status, regular, TextAlignment.LEFT, background);
            addBody(table, amount(instrument.getMontant()), bold, TextAlignment.RIGHT, background);
        }
        document.add(table);
    }

    private void writeAllocations(Document document, ReglementClient payment, PdfFont regular, PdfFont bold) {
        document.add(sectionTitle("Affectations", bold).setMarginTop(14));
        Table table = new Table(new float[]{1.1f, 3f, 1f, 0.95f})
                .setWidth(UnitValue.createPercentValue(100));
        addHeader(table, "MOYEN", bold, TextAlignment.LEFT);
        addHeader(table, "CRÉANCE / DOCUMENT", bold, TextAlignment.LEFT);
        addHeader(table, "STATUT", bold, TextAlignment.LEFT);
        addHeader(table, "MONTANT", bold, TextAlignment.RIGHT);

        int index = 0;
        for (InstrumentReglementClient instrument : payment.getInstruments().stream()
                .sorted(Comparator.comparing(InstrumentReglementClient::getId))
                .toList()) {
            for (AffectationReglementClient allocation : instrument.getAffectations().stream()
                    .sorted(Comparator.comparing(AffectationReglementClient::getId))
                    .toList()) {
                DeviceRgb background = index++ % 2 == 1 ? SOFT_BLUE : null;
                addBody(table, instrumentReference(instrument), regular, TextAlignment.LEFT, background);
                addBody(table, allocationDestination(allocation), regular, TextAlignment.LEFT, background);
                addBody(table, allocationStatus(allocation.getStatut()), regular, TextAlignment.LEFT, background);
                addBody(table, amount(allocation.getMontant()), bold, TextAlignment.RIGHT, background);
            }
        }
        if (index == 0) {
            table.addCell(new Cell(1, 4)
                    .add(new Paragraph("Aucune affectation").setFont(regular).setFontSize(8).setMargin(0))
                    .setTextAlignment(TextAlignment.CENTER).setFontColor(MUTED)
                    .setBorder(new SolidBorder(BORDER, 0.45f)).setPadding(10));
        }
        document.add(table);
    }

    private void writeNotes(Document document, ReglementClient payment, PdfFont regular, PdfFont bold) {
        if (payment.getNotes() == null || payment.getNotes().isBlank()) {
            return;
        }
        Cell notes = new Cell().setBorder(new SolidBorder(BORDER, 0.6f)).setPadding(9)
                .setBackgroundColor(SOFT_BLUE);
        notes.add(new Paragraph("NOTES").setFont(bold).setFontSize(7).setFontColor(MUTED).setMargin(0));
        notes.add(new Paragraph(payment.getNotes().trim()).setFont(regular).setFontSize(8.5f).setMarginTop(4));
        document.add(new Table(new float[]{1}).setWidth(UnitValue.createPercentValue(100))
                .setMarginTop(12).addCell(notes));
    }

    private void writeNotice(Document document, ReglementClient payment, PdfFont regular, PdfFont bold) {
        boolean pending = payment.getInstruments().stream().anyMatch(instrument ->
                instrument.getStatut() == StatutInstrumentReglement.EN_ATTENTE
                        || instrument.getStatut() == StatutInstrumentReglement.REMIS_EN_BANQUE);
        if (payment.getStatut() == StatutReglementClient.ANNULE) {
            String reason = payment.getMotifAnnulation() == null ? "" : " - " + payment.getMotifAnnulation();
            document.add(new Paragraph("RÈGLEMENT ANNULÉ" + reason)
                    .setFont(bold).setFontSize(10).setFontColor(ColorConstants.RED)
                    .setTextAlignment(TextAlignment.CENTER).setMarginTop(12));
        } else if (pending) {
            document.add(new Paragraph("Ce document confirme l’enregistrement du règlement. "
                            + "Les instruments en attente ou remis en banque ne sont pas encore définitivement encaissés.")
                    .setFont(regular).setFontSize(8).setFontColor(MUTED)
                    .setBackgroundColor(SOFT_ACCENT).setPadding(8).setMarginTop(12));
        }
    }

    private void writeSignatures(Document document, PdfFont bold) {
        Table signatures = new Table(new float[]{1, 1})
                .setWidth(UnitValue.createPercentValue(100))
                .setKeepTogether(true)
                .setMarginTop(14);
        signatures.addCell(signatureCell("Cachet et signature de l’agence", bold));
        signatures.addCell(signatureCell("Signature du client", bold));
        document.add(signatures);
    }

    private void writeFooter(
            com.itextpdf.kernel.events.PdfDocumentEvent event,
            ReglementClient payment,
            PdfFont regular,
            PdfFont bold
    ) {
        PdfDocument pdf = event.getDocument();
        PdfPage page = event.getPage();
        Rectangle pageSize = page.getPageSize();
        PdfCanvas canvas = new PdfCanvas(page.newContentStreamAfter(), page.getResources(), pdf);
        canvas.setStrokeColor(FOOTER_ACCENT).setLineWidth(0.65f)
                .moveTo(PAGE_MARGIN, 57).lineTo(pageSize.getWidth() - PAGE_MARGIN, 57).stroke();
        Canvas footer = new Canvas(canvas, pdf, new Rectangle(
                PAGE_MARGIN, 9, pageSize.getWidth() - PAGE_MARGIN * 2, 44));
        Agence agency = payment.getAgence();
        addFooterLine(footer, contactLine(agency), regular);
        addFooterLine(footer, addressLine(agency), regular);
        addFooterLine(footer, legalLine(agency), regular);
        String bank = bankLine(agency);
        if (!bank.isBlank()) {
            addFooterLine(footer, bank, bold);
        }
        addFooterLine(footer, payment.getNumero() + " · Page " + pdf.getPageNumber(page), regular);
        footer.close();
    }

    private String allocationDestination(AffectationReglementClient allocation) {
        DocumentClient clientDocument = allocation.getDocumentClient();
        ElementFacturable element = allocation.getElementFacturable();
        if (clientDocument != null) {
            String documentLabel = switch (clientDocument.getTypeDocument()) {
                case FACTURE -> "Facture ";
                case RELEVE -> "Relevé ";
            };
            return join(documentLabel + clientDocument.getNumero(), elementReference(element));
        }
        return elementReference(element);
    }

    private String elementReference(ElementFacturable element) {
        if (element == null) {
            return "-";
        }
        Contrat contract = element.getContrat();
        String contractReference = contract == null ? null
                : join(contract.getNumeroPolice(), contract.getNumeroDossier());
        return join(element.getLibelle(), contractReference);
    }

    private String instrumentReference(InstrumentReglementClient instrument) {
        return join(modeLabel(instrument.getMode()), instrument.getReferenceInstrument());
    }

    private Paragraph sectionTitle(String text, PdfFont bold) {
        return new Paragraph(text).setFont(bold).setFontSize(10).setFontColor(INK).setMarginBottom(7);
    }

    private Cell totalLabelCell(String label, PdfFont bold) {
        return new Cell()
                .add(new Paragraph(label).setFont(bold).setFontSize(8.5f)
                        .setFontColor(ColorConstants.WHITE).setMargin(0))
                .setTextAlignment(TextAlignment.CENTER)
                .setBorder(new SolidBorder(ACCENT, 0.65f))
                .setBackgroundColor(TABLE_HEADER)
                .setPadding(5);
    }

    private Cell totalValueCell(String content, PdfFont bold) {
        return new Cell()
                .add(new Paragraph(content).setFont(bold).setFontSize(8.5f)
                        .setFontColor(INK).setMargin(0))
                .setTextAlignment(TextAlignment.RIGHT)
                .setBorder(new SolidBorder(ACCENT, 0.65f))
                .setBackgroundColor(SOFT_ACCENT)
                .setPadding(5);
    }

    private Cell infoCell(String label, String content, PdfFont regular, PdfFont bold) {
        Cell cell = new Cell().setBorder(new SolidBorder(BORDER, 0.6f)).setPadding(8);
        cell.add(new Paragraph(label).setFont(bold).setFontSize(6.8f).setFontColor(MUTED).setMargin(0));
        cell.add(new Paragraph(value(content)).setFont(regular).setFontSize(9)
                .setFontColor(INK).setMarginTop(4).setMarginBottom(0));
        return cell;
    }

    private Cell signatureCell(String label, PdfFont bold) {
        return new Cell().setMinHeight(52).setPadding(7).setBorder(new SolidBorder(ACCENT, 0.65f))
                .add(new Paragraph(label).setFont(bold).setFontSize(8).setFontColor(MUTED));
    }

    private void addHeader(Table table, String text, PdfFont bold, TextAlignment alignment) {
        table.addHeaderCell(new Cell().add(new Paragraph(text).setFont(bold).setFontSize(6.5f).setMargin(0))
                .setBackgroundColor(TABLE_HEADER).setFontColor(ColorConstants.WHITE)
                .setTextAlignment(alignment).setVerticalAlignment(VerticalAlignment.MIDDLE)
                .setBorder(new SolidBorder(ColorConstants.WHITE, 0.35f)).setPadding(5));
    }

    private void addBody(Table table, String text, PdfFont font, TextAlignment alignment, DeviceRgb background) {
        Cell body = new Cell().add(new Paragraph(value(text)).setFont(font).setFontSize(7).setMargin(0))
                .setTextAlignment(alignment).setVerticalAlignment(VerticalAlignment.MIDDLE)
                .setBorder(new SolidBorder(BORDER, 0.45f)).setPadding(5);
        if (background != null) {
            body.setBackgroundColor(background);
        }
        table.addCell(body);
    }

    private Cell cell() {
        return new Cell().setBorder(Border.NO_BORDER).setPadding(0);
    }

    private String paymentStatus(ReglementClient payment) {
        if (payment.getStatut() == StatutReglementClient.ANNULE) {
            return "ANNULÉ";
        }
        if (!payment.getInstruments().isEmpty() && payment.getInstruments().stream()
                .allMatch(instrument -> instrument.getStatut() == StatutInstrumentReglement.CONFIRME)) {
            return "ENCAISSÉ";
        }
        if (payment.getInstruments().stream().anyMatch(instrument ->
                instrument.getStatut() == StatutInstrumentReglement.EN_ATTENTE
                        || instrument.getStatut() == StatutInstrumentReglement.REMIS_EN_BANQUE)) {
            return "ENCAISSEMENT EN COURS";
        }
        if (payment.getInstruments().stream().anyMatch(instrument ->
                instrument.getStatut() == StatutInstrumentReglement.REJETE)) {
            return "INSTRUMENT REJETÉ";
        }
        return "ENREGISTRÉ";
    }

    private String modeLabel(ModeReglementClient mode) {
        return switch (mode) {
            case ESPECES -> "Espèces";
            case CHEQUE -> "Chèque";
            case EFFET -> "Effet";
            case VIREMENT -> "Virement";
            case VERSEMENT_BANCAIRE -> "Versement bancaire";
            case CARTE -> "Carte";
            case PRELEVEMENT -> "Prélèvement";
        };
    }

    private String instrumentStatus(InstrumentReglementClient instrument) {
        return switch (instrument.getStatut()) {
            case EN_ATTENTE -> Boolean.TRUE.equals(instrument.getReglementBureau())
                    ? "Règlement au bureau" : "À remettre";
            case REMIS_EN_BANQUE -> "Remis en banque";
            case CONFIRME -> "Confirmé";
            case REJETE -> "Rejeté";
            case REMPLACE -> "Remplacé";
        };
    }

    private String allocationStatus(StatutAffectationReglement status) {
        return switch (status) {
            case EN_ATTENTE -> "En attente";
            case CONFIRMEE -> "Confirmée";
            case ANNULEE -> "Annulée";
        };
    }

    private String payerAddress(ReglementClient payment) {
        Client payer = payment.getClientPayeur();
        if (payer == null && payment.getGroupePayeur() != null) {
            payer = payment.getGroupePayeur().getClientTresorerie();
        }
        if (payer == null) {
            return "-";
        }
        String address = joinAvailable(
                payer.getAdresse(),
                payer.getVille() == null ? null : payer.getVille().getNom()
        );
        return address.isBlank() ? "-" : address.toUpperCase(Locale.FRENCH);
    }

    private String payerIdentity(ReglementClient payment) {
        String address = payerAddress(payment);
        return address.equals("-")
                ? value(payment.getPayeurNom())
                : value(payment.getPayeurNom()) + "\n" + address;
    }

    private String city(Agence agency) {
        return agency.getVille() == null || agency.getVille().isBlank() ? "" : agency.getVille().trim();
    }

    private void addFooterLine(Canvas footer, String content, PdfFont font) {
        if (content == null || content.isBlank()) {
            return;
        }
        footer.add(new Paragraph(content).setFont(font).setFontSize(6.7f).setFontColor(INK)
                .setTextAlignment(TextAlignment.CENTER).setMargin(0).setMultipliedLeading(1.02f));
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
        append(result, "Adresse : ", joinAvailable(agency.getAdresse(), agency.getVille()));
        append(result, "IF : ", agency.getIdentifiantFiscal());
        append(result, "Patente : ", agency.getPatente());
        append(result, "ICE : ", agency.getIce());
        return result.toString();
    }

    private String legalLine(Agence agency) {
        if (agency.getNumeroAgrement() == null || agency.getNumeroAgrement().isBlank()) {
            return "";
        }
        StringBuilder result = new StringBuilder(
                "Intermédiaire d'assurances régi par la loi 17-99, portant code des assurances sous le n° d'agrément : "
        ).append(agency.getNumeroAgrement().trim());
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

    private String date(LocalDate date) {
        return date == null ? "-" : DATE_FORMAT.format(date);
    }

    private String amount(BigDecimal amount) {
        DecimalFormatSymbols symbols = DecimalFormatSymbols.getInstance(Locale.FRANCE);
        return new DecimalFormat("#,##0.00", symbols)
                .format(amount == null ? BigDecimal.ZERO : amount)
                .replace('\u202f', ' ')
                .replace('\u00a0', ' ');
    }

    private String value(String text) {
        return text == null || text.isBlank() ? "-" : text.trim();
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
