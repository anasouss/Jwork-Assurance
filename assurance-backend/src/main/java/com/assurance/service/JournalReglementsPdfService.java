package com.assurance.service;

import com.assurance.entity.Agence;
import com.assurance.entity.InstrumentReglementClient;
import com.assurance.entity.ReglementClient;
import com.assurance.entity.Utilisateur;
import com.assurance.enums.ModeReglementClient;
import com.assurance.enums.StatutInstrumentReglement;
import com.assurance.enums.StatutReglementClient;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.AgenceRepository;
import com.assurance.repository.InstrumentReglementClientRepository;
import com.assurance.repository.UtilisateurRepository;
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
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.EnumMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class JournalReglementsPdfService {

    private static final DeviceRgb INK = new DeviceRgb(17, 48, 78);
    private static final DeviceRgb TABLE_HEADER = new DeviceRgb(35, 78, 116);
    private static final DeviceRgb ACCENT = new DeviceRgb(0, 147, 211);
    private static final DeviceRgb SOFT_BLUE = new DeviceRgb(248, 250, 252);
    private static final DeviceRgb SOFT_ACCENT = new DeviceRgb(232, 244, 250);
    private static final DeviceRgb BORDER = new DeviceRgb(157, 171, 184);
    private static final DeviceRgb MUTED = new DeviceRgb(71, 85, 105);
    private static final float PAGE_MARGIN = 24f;
    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter DATE_TIME_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    private final InstrumentReglementClientRepository instrumentRepository;
    private final AgenceRepository agenceRepository;
    private final UtilisateurRepository utilisateurRepository;
    private final AgencyLogoStorageService agencyLogoStorageService;

    @Transactional(readOnly = true)
    public byte[] generate(
            Long agenceId,
            LocalDate dateDu,
            LocalDate dateAu,
            Long utilisateurId,
            ModeReglementClient mode,
            StatutReglementClient statutReglement
    ) {
        validatePeriod(dateDu, dateAu);
        Agence agency = agenceRepository.findById(agenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Agence", agenceId));
        Utilisateur selectedUser = findSelectedUser(agenceId, utilisateurId);
        List<InstrumentReglementClient> instruments = instrumentRepository.findForPaymentJournal(
                agenceId,
                dateDu.atStartOfDay(),
                dateAu.plusDays(1).atStartOfDay(),
                utilisateurId,
                mode,
                statutReglement
        );

        try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            PdfDocument pdf = new PdfDocument(new PdfWriter(output));
            Document document = new Document(pdf, PageSize.A4.rotate());
            document.setMargins(22, PAGE_MARGIN, 46, PAGE_MARGIN);
            PdfFont regular = PdfFontFactory.createFont(StandardFonts.HELVETICA);
            PdfFont bold = PdfFontFactory.createFont(StandardFonts.HELVETICA_BOLD);
            document.setFont(regular).setFontSize(8).setFontColor(INK);
            pdf.addEventHandler(com.itextpdf.kernel.events.PdfDocumentEvent.END_PAGE,
                    event -> writeFooter(
                            (com.itextpdf.kernel.events.PdfDocumentEvent) event,
                            agency,
                            regular
                    ));

            writeHeader(document, agency, dateDu, dateAu, regular, bold);
            writeFilters(document, dateDu, dateAu, selectedUser, mode, statutReglement, regular, bold);
            writeOverview(document, instruments, regular, bold);
            writeModeSummary(document, instruments, regular, bold);
            writeDetails(document, instruments, regular, bold);

            document.close();
            return output.toByteArray();
        } catch (Exception exception) {
            log.error("Failed to generate payment journal PDF for agency {}", agenceId, exception);
            throw new BadRequestException("La génération du journal des règlements a échoué");
        }
    }

    private void validatePeriod(LocalDate dateDu, LocalDate dateAu) {
        if (dateDu == null || dateAu == null) {
            throw new BadRequestException("La période du journal est obligatoire");
        }
        if (dateDu.isAfter(dateAu)) {
            throw new BadRequestException("La date de début doit précéder la date de fin");
        }
        if (ChronoUnit.DAYS.between(dateDu, dateAu) > 366) {
            throw new BadRequestException("La période du journal ne peut pas dépasser 366 jours");
        }
    }

    private Utilisateur findSelectedUser(Long agenceId, Long utilisateurId) {
        if (utilisateurId == null) {
            return null;
        }
        Utilisateur user = utilisateurRepository.findById(utilisateurId)
                .orElseThrow(() -> new BadRequestException("Utilisateur invalide"));
        if (user.getAgence() == null || !agenceId.equals(user.getAgence().getId())) {
            throw new BadRequestException("Utilisateur invalide");
        }
        return user;
    }

    private void writeHeader(
            Document document,
            Agence agency,
            LocalDate dateDu,
            LocalDate dateAu,
            PdfFont regular,
            PdfFont bold
    ) {
        Table header = new Table(new float[]{1, 2})
                .setWidth(UnitValue.createPercentValue(100))
                .setMarginBottom(4);
        Cell identity = cell().setVerticalAlignment(VerticalAlignment.MIDDLE);
        byte[] logo = agencyLogoStorageService.loadBytesIfPresent(agency.getLogoCheminStockage());
        if (logo != null && logo.length > 0) {
            Image image = new Image(ImageDataFactory.create(logo));
            image.scaleToFit(170, 54);
            identity.add(image);
        } else {
            identity.add(new Paragraph(agency.getNom()).setFont(bold).setFontSize(14));
        }
        header.addCell(identity);

        String period = dateDu.equals(dateAu)
                ? DATE_FORMAT.format(dateDu)
                : DATE_FORMAT.format(dateDu) + " au " + DATE_FORMAT.format(dateAu);
        Cell title = cell().setTextAlignment(TextAlignment.RIGHT)
                .setVerticalAlignment(VerticalAlignment.MIDDLE);
        title.add(new Paragraph("JOURNAL DES RÈGLEMENTS CLIENTS")
                .setFont(bold).setFontSize(15).setMargin(0));
        title.add(new Paragraph("Période de saisie : " + period)
                .setFont(regular).setFontSize(9).setFontColor(MUTED)
                .setMarginTop(5).setMarginBottom(0));
        title.add(new Paragraph("Généré le " + DATE_TIME_FORMAT.format(LocalDateTime.now()))
                .setFont(regular).setFontSize(7.5f).setFontColor(MUTED)
                .setMarginTop(3).setMarginBottom(0));
        header.addCell(title);
        document.add(header);
        document.add(new Paragraph("")
                .setBorderBottom(new SolidBorder(ACCENT, 0.8f))
                .setMarginTop(0).setMarginBottom(10));
    }

    private void writeFilters(
            Document document,
            LocalDate dateDu,
            LocalDate dateAu,
            Utilisateur user,
            ModeReglementClient mode,
            StatutReglementClient status,
            PdfFont regular,
            PdfFont bold
    ) {
        Table filters = new Table(new float[]{1, 1.5f, 1.2f, 1.2f})
                .setWidth(UnitValue.createPercentValue(100))
                .setMarginBottom(10);
        filters.addCell(infoCell("PÉRIODE DE SAISIE", date(dateDu) + " - " + date(dateAu), regular, bold));
        filters.addCell(infoCell("UTILISATEUR", user == null ? "Tous les utilisateurs" : user.getFullName(), regular, bold));
        filters.addCell(infoCell("MODE", mode == null ? "Tous les modes" : modeLabel(mode), regular, bold));
        filters.addCell(infoCell("STATUT DU RÈGLEMENT", paymentFilterLabel(status), regular, bold));
        document.add(filters);
    }

    private void writeOverview(
            Document document,
            List<InstrumentReglementClient> instruments,
            PdfFont regular,
            PdfFont bold
    ) {
        Set<Long> validPayments = new HashSet<>();
        Set<Long> cancelledPayments = new HashSet<>();
        BigDecimal validAmount = BigDecimal.ZERO;
        BigDecimal cancelledAmount = BigDecimal.ZERO;
        for (InstrumentReglementClient instrument : instruments) {
            ReglementClient payment = instrument.getReglement();
            if (payment.getStatut() == StatutReglementClient.ANNULE) {
                cancelledPayments.add(payment.getId());
                cancelledAmount = cancelledAmount.add(instrument.getMontant());
            } else {
                validPayments.add(payment.getId());
                validAmount = validAmount.add(instrument.getMontant());
            }
        }

        Table overview = new Table(new float[]{1, 1, 1, 1})
                .setWidth(UnitValue.createPercentValue(100))
                .setMarginBottom(12);
        overview.addCell(metricCell("RÈGLEMENTS ACTIFS", String.valueOf(validPayments.size()), regular, bold));
        overview.addCell(metricCell("MONTANT ENREGISTRÉ", amount(validAmount) + " MAD", regular, bold)
                .setBackgroundColor(SOFT_ACCENT));
        overview.addCell(metricCell("RÈGLEMENTS ANNULÉS", String.valueOf(cancelledPayments.size()), regular, bold));
        overview.addCell(metricCell("MONTANT ANNULÉ", amount(cancelledAmount) + " MAD", regular, bold));
        document.add(overview);
    }

    private void writeModeSummary(
            Document document,
            List<InstrumentReglementClient> instruments,
            PdfFont regular,
            PdfFont bold
    ) {
        Map<ModeReglementClient, ModeTotals> totals = new EnumMap<>(ModeReglementClient.class);
        instruments.stream()
                .filter(instrument -> instrument.getReglement().getStatut() == StatutReglementClient.VALIDE)
                .forEach(instrument -> totals.computeIfAbsent(instrument.getMode(), ignored -> new ModeTotals())
                        .add(instrument));

        document.add(sectionTitle("Synthèse par moyen de paiement", bold));
        Table table = new Table(new float[]{1.5f, 0.5f, 1, 1, 1, 1})
                .setWidth(UnitValue.createPercentValue(100))
                .setMarginBottom(12);
        addHeader(table, "MODE", bold, TextAlignment.LEFT);
        addHeader(table, "NB", bold, TextAlignment.CENTER);
        addHeader(table, "MONTANT", bold, TextAlignment.RIGHT);
        addHeader(table, "EN COURS", bold, TextAlignment.RIGHT);
        addHeader(table, "CONFIRMÉ", bold, TextAlignment.RIGHT);
        addHeader(table, "REJETÉ", bold, TextAlignment.RIGHT);

        int index = 0;
        for (ModeReglementClient mode : ModeReglementClient.values()) {
            ModeTotals row = totals.get(mode);
            if (row == null) {
                continue;
            }
            DeviceRgb background = index++ % 2 == 1 ? SOFT_BLUE : null;
            addBody(table, modeLabel(mode), regular, TextAlignment.LEFT, background);
            addBody(table, String.valueOf(row.count), regular, TextAlignment.CENTER, background);
            addBody(table, amount(row.total), bold, TextAlignment.RIGHT, background);
            addBody(table, amount(row.pending), regular, TextAlignment.RIGHT, background);
            addBody(table, amount(row.confirmed), regular, TextAlignment.RIGHT, background);
            addBody(table, amount(row.rejected), regular, TextAlignment.RIGHT, background);
        }
        if (totals.isEmpty()) {
            table.addCell(new Cell(1, 6)
                    .add(new Paragraph("Aucun règlement valide pour les critères sélectionnés")
                            .setFont(regular).setFontSize(8).setMargin(0))
                    .setTextAlignment(TextAlignment.CENTER)
                    .setBorder(new SolidBorder(BORDER, 0.45f))
                    .setPadding(8));
        }
        document.add(table);
    }

    private void writeDetails(
            Document document,
            List<InstrumentReglementClient> instruments,
            PdfFont regular,
            PdfFont bold
    ) {
        document.add(sectionTitle("Détail des règlements", bold));
        Table table = new Table(new float[]{0.9f, 0.7f, 1.05f, 1.45f, 1.2f, 0.8f, 1, 1.05f, 0.8f, 0.8f})
                .setWidth(UnitValue.createPercentValue(100));
        addHeader(table, "SAISI LE", bold, TextAlignment.CENTER);
        addHeader(table, "DATE RÈGL.", bold, TextAlignment.CENTER);
        addHeader(table, "N° RÈGLEMENT", bold, TextAlignment.LEFT);
        addHeader(table, "PAYEUR", bold, TextAlignment.LEFT);
        addHeader(table, "UTILISATEUR", bold, TextAlignment.LEFT);
        addHeader(table, "MODE", bold, TextAlignment.LEFT);
        addHeader(table, "RÉFÉRENCE", bold, TextAlignment.LEFT);
        addHeader(table, "STATUT MOYEN", bold, TextAlignment.LEFT);
        addHeader(table, "RÈGLEMENT", bold, TextAlignment.LEFT);
        addHeader(table, "MONTANT", bold, TextAlignment.RIGHT);

        int index = 0;
        for (InstrumentReglementClient instrument : instruments) {
            ReglementClient payment = instrument.getReglement();
            DeviceRgb background = index++ % 2 == 1 ? SOFT_BLUE : null;
            addBody(table, dateTime(payment.getCreatedAt()), regular, TextAlignment.CENTER, background);
            addBody(table, date(payment.getDateReglement()), regular, TextAlignment.CENTER, background);
            addBody(table, payment.getNumero(), bold, TextAlignment.LEFT, background);
            addBody(table, payment.getPayeurNom(), regular, TextAlignment.LEFT, background);
            addBody(table, payment.getCreePar() == null ? "-" : payment.getCreePar().getFullName(), regular,
                    TextAlignment.LEFT, background);
            addBody(table, modeLabel(instrument.getMode()), regular, TextAlignment.LEFT, background);
            addBody(table, value(instrument.getReferenceInstrument()), regular, TextAlignment.LEFT, background);
            addBody(table, instrumentStatus(instrument), regular, TextAlignment.LEFT, background);
            addBody(table, payment.getStatut() == StatutReglementClient.ANNULE ? "Annulé" : "Valide", regular,
                    TextAlignment.LEFT, background);
            addBody(table, amount(instrument.getMontant()), bold, TextAlignment.RIGHT, background);
        }
        if (instruments.isEmpty()) {
            table.addCell(new Cell(1, 10)
                    .add(new Paragraph("Aucun règlement pour les critères sélectionnés")
                            .setFont(regular).setFontSize(8).setMargin(0))
                    .setTextAlignment(TextAlignment.CENTER)
                    .setBorder(new SolidBorder(BORDER, 0.45f))
                    .setPadding(10));
        }
        document.add(table);
        document.add(new Paragraph(
                "Les chèques et effets en attente ou remis en banque sont enregistrés, mais ne sont pas encore définitivement encaissés."
        ).setFont(regular).setFontSize(7.5f).setFontColor(MUTED).setMarginTop(8).setMarginBottom(0));
    }

    private void writeFooter(
            com.itextpdf.kernel.events.PdfDocumentEvent event,
            Agence agency,
            PdfFont regular
    ) {
        PdfDocument pdf = event.getDocument();
        PdfPage page = event.getPage();
        Rectangle pageSize = page.getPageSize();
        PdfCanvas canvas = new PdfCanvas(page.newContentStreamAfter(), page.getResources(), pdf);
        canvas.setStrokeColor(ACCENT).setLineWidth(0.5f)
                .moveTo(PAGE_MARGIN, 34).lineTo(pageSize.getWidth() - PAGE_MARGIN, 34).stroke();
        Canvas footer = new Canvas(canvas, pdf, new Rectangle(
                PAGE_MARGIN, 12, pageSize.getWidth() - PAGE_MARGIN * 2, 16));
        footer.add(new Paragraph(agencyLine(agency) + " · Journal des règlements · Page "
                        + pdf.getPageNumber(page))
                .setFont(regular).setFontSize(6.8f).setFontColor(MUTED)
                .setTextAlignment(TextAlignment.CENTER).setMargin(0));
        footer.close();
    }

    private Cell infoCell(String label, String content, PdfFont regular, PdfFont bold) {
        Cell result = new Cell().setBorder(new SolidBorder(BORDER, 0.55f)).setPadding(6);
        result.add(new Paragraph(label).setFont(bold).setFontSize(6.5f).setFontColor(MUTED).setMargin(0));
        result.add(new Paragraph(value(content)).setFont(regular).setFontSize(8.5f)
                .setMarginTop(3).setMarginBottom(0));
        return result;
    }

    private Cell metricCell(String label, String content, PdfFont regular, PdfFont bold) {
        Cell result = infoCell(label, content, regular, bold);
        result.setTextAlignment(TextAlignment.CENTER);
        return result;
    }

    private Paragraph sectionTitle(String text, PdfFont bold) {
        return new Paragraph(text).setFont(bold).setFontSize(9.5f).setMarginBottom(6);
    }

    private void addHeader(Table table, String text, PdfFont bold, TextAlignment alignment) {
        table.addHeaderCell(new Cell()
                .add(new Paragraph(text).setFont(bold).setFontSize(6.2f).setMargin(0))
                .setBackgroundColor(TABLE_HEADER).setFontColor(ColorConstants.WHITE)
                .setTextAlignment(alignment).setVerticalAlignment(VerticalAlignment.MIDDLE)
                .setBorder(new SolidBorder(ColorConstants.WHITE, 0.3f)).setPadding(5));
    }

    private void addBody(Table table, String text, PdfFont font, TextAlignment alignment, DeviceRgb background) {
        Cell body = new Cell()
                .add(new Paragraph(value(text)).setFont(font).setFontSize(6.8f).setMargin(0))
                .setTextAlignment(alignment).setVerticalAlignment(VerticalAlignment.MIDDLE)
                .setBorder(new SolidBorder(BORDER, 0.4f)).setPadding(4);
        if (background != null) {
            body.setBackgroundColor(background);
        }
        table.addCell(body);
    }

    private Cell cell() {
        return new Cell().setBorder(Border.NO_BORDER).setPadding(0);
    }

    private String paymentFilterLabel(StatutReglementClient status) {
        if (status == null) {
            return "Tous les statuts";
        }
        return status == StatutReglementClient.VALIDE ? "Valides" : "Annulés";
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

    private String date(LocalDate date) {
        return date == null ? "-" : DATE_FORMAT.format(date);
    }

    private String dateTime(LocalDateTime dateTime) {
        return dateTime == null ? "-" : DATE_TIME_FORMAT.format(dateTime);
    }

    private String amount(BigDecimal number) {
        DecimalFormatSymbols symbols = DecimalFormatSymbols.getInstance(Locale.FRANCE);
        return new DecimalFormat("#,##0.00", symbols).format(number == null ? BigDecimal.ZERO : number)
                .replace('\u202f', ' ')
                .replace('\u00a0', ' ');
    }

    private String value(String text) {
        return text == null || text.isBlank() ? "-" : text.trim();
    }

    private String agencyLine(Agence agency) {
        return join(agency.getNom(), agency.getVille(), agency.getTelephone(), agency.getEmail());
    }

    private String join(String... values) {
        return java.util.Arrays.stream(values)
                .filter(value -> value != null && !value.isBlank())
                .map(String::trim)
                .reduce((left, right) -> left + " · " + right)
                .orElse("");
    }

    private static final class ModeTotals {
        private int count;
        private BigDecimal total = BigDecimal.ZERO;
        private BigDecimal pending = BigDecimal.ZERO;
        private BigDecimal confirmed = BigDecimal.ZERO;
        private BigDecimal rejected = BigDecimal.ZERO;

        private void add(InstrumentReglementClient instrument) {
            count++;
            total = total.add(instrument.getMontant());
            switch (instrument.getStatut()) {
                case EN_ATTENTE, REMIS_EN_BANQUE -> pending = pending.add(instrument.getMontant());
                case CONFIRME -> confirmed = confirmed.add(instrument.getMontant());
                case REJETE -> rejected = rejected.add(instrument.getMontant());
                case REMPLACE -> {
                    // Replaced instruments are excluded by the repository query.
                }
            }
        }
    }
}
