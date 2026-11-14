package com.assurance.service;

import com.assurance.entity.AffectationReglementClient;
import com.assurance.entity.Agence;
import com.assurance.entity.Client;
import com.assurance.entity.DocumentClient;
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
import com.assurance.repository.AssistanceContratRepository;
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
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class ReglementClientPdfService {

    private static final DeviceRgb INK = new DeviceRgb(28, 28, 28);
    private static final DeviceRgb ACCENT = new DeviceRgb(17, 48, 78);
    private static final DeviceRgb TABLE_HEADER = new DeviceRgb(35, 78, 116);
    private static final DeviceRgb FOOTER_ACCENT = new DeviceRgb(0, 147, 211);
    private static final DeviceRgb SOFT_ACCENT = new DeviceRgb(232, 244, 250);
    private static final DeviceRgb SOFT_BLUE = new DeviceRgb(248, 250, 252);
    private static final DeviceRgb BORDER = new DeviceRgb(157, 171, 184);
    private static final DeviceRgb MUTED = new DeviceRgb(82, 82, 82);
    private static final float PAGE_MARGIN = 24f;
    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final ReglementClientRepository reglementRepository;
    private final InstrumentReglementClientRepository instrumentRepository;
    private final AgencyLogoStorageService agencyLogoStorageService;
    private final AssistanceContratRepository assistanceRepository;

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

            writeHeader(document, payment, bold);
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
                .setFont(bold).setFontSize(14).setFontColor(ACCENT).setMargin(0));
        title.add(new Paragraph(payment.getNumero())
                .setFont(bold).setFontSize(10.5f).setFontColor(INK)
                .setMarginTop(5).setMarginBottom(0));
        title.add(new Paragraph(joinAvailable(city(payment.getAgence()), date(payment.getDateReglement())))
                .setFont(bold).setFontSize(10.5f).setFontColor(INK)
                .setMarginTop(3).setMarginBottom(0));
        header.addCell(title);
        document.add(header);
        document.add(new Paragraph("")
                .setBorderBottom(new SolidBorder(FOOTER_ACCENT, 0.8f))
                .setMarginTop(0).setMarginBottom(12));
    }

    private void writeOverview(Document document, ReglementClient payment, PdfFont regular, PdfFont bold) {
        Table overview = new Table(new float[]{2.1f, 1})
                .setWidth(UnitValue.createPercentValue(100)).setMarginBottom(12).setKeepTogether(true);
        boolean multiPayer = Boolean.TRUE.equals(payment.getMultiPayeur());
        overview.addCell(infoCell(payment.getSens() == com.assurance.enums.SensMouvementTresorerie.SORTIE
                        ? "BÉNÉFICIAIRE" : multiPayer ? "REPRÉSENTANT" : "PAYEUR",
                multiPayer ? payment.getDeposantNom() : payerIdentity(payment), regular, bold));
        overview.addCell(infoCell("OPÉRATEUR",
                payment.getCreePar() == null ? null : payment.getCreePar().getFullName(), regular, bold));
        document.add(overview);

    }

    private void writeInstruments(Document document, ReglementClient payment, PdfFont regular, PdfFont bold) {
        document.add(sectionTitle("Mode de règlement", bold));
        boolean showDueDate = payment.getInstruments().stream()
                .anyMatch(instrument -> instrument.getMode() == ModeReglementClient.EFFET);
        Table table = new Table(showDueDate
                ? new float[]{1f, 0.8f, 0.8f, 1.35f, 1.35f, 0.9f}
                : new float[]{1.05f, 0.8f, 1.4f, 1.4f, 0.9f})
                .setWidth(UnitValue.createPercentValue(100));
        addHeader(table, "MODE", bold, TextAlignment.LEFT);
        addHeader(table, "DATE", bold, TextAlignment.CENTER);
        if (showDueDate) {
            addHeader(table, "ÉCHÉANCE", bold, TextAlignment.CENTER);
        }
        addHeader(table, "RÉFÉRENCE", bold, TextAlignment.LEFT);
        addHeader(table, "BANQUE / COMPTE", bold, TextAlignment.LEFT);
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
            addBody(table, modeLabel(instrument.getMode()), regular, TextAlignment.LEFT, background);
            addBody(table, date(instrument.getDateInstrument()), regular, TextAlignment.CENTER, background);
            if (showDueDate) {
                addBody(table, instrument.getMode() == ModeReglementClient.EFFET
                        ? date(instrument.getDateEcheance()) : "-", regular, TextAlignment.CENTER, background);
            }
            addBody(table, value(instrument.getReferenceInstrument()), regular, TextAlignment.LEFT, background);
            addBody(table, bank, regular, TextAlignment.LEFT, background);
            addBody(table, amount(instrument.getMontant()), bold, TextAlignment.RIGHT, background);
        }
        document.add(table);
    }

    private void writeAllocations(Document document, ReglementClient payment, PdfFont regular, PdfFont bold) {
        document.add(sectionTitle("Affectations", bold).setMarginTop(14));
        Map<String, AllocationSummary> allocations = groupedAllocations(payment);
        if (!allocations.isEmpty()) {
            int instrumentCount = allocations.values().stream()
                    .flatMap(summary -> summary.instrumentIds.stream())
                    .collect(java.util.stream.Collectors.toSet())
                    .size();
            document.add(new Paragraph(instrumentCount + " moyen" + (instrumentCount > 1 ? "s" : "")
                            + " de paiement · " + allocations.size() + " destination"
                            + (allocations.size() > 1 ? "s" : "") + " affectée"
                            + (allocations.size() > 1 ? "s" : ""))
                    .setFont(regular).setFontSize(7.5f).setFontColor(MUTED)
                    .setMarginTop(-4).setMarginBottom(6));
        }
        boolean showDocument = allocations.values().stream().anyMatch(allocation -> allocation.document != null);
        float[] columns = showDocument
                ? new float[]{1.35f, 2f, 1.1f, 1.3f, 0.55f, 0.85f, 1f}
                : new float[]{1.35f, 2.4f, 1.3f, 0.55f, 0.85f, 1f};
        Table table = new Table(columns)
                .setWidth(UnitValue.createPercentValue(100));
        addHeader(table, "N° POLICE / CONTRAT", bold, TextAlignment.LEFT);
        addHeader(table, "MOUVEMENT / PRESTATION", bold, TextAlignment.LEFT);
        if (showDocument) {
            addHeader(table, "DOCUMENT", bold, TextAlignment.LEFT);
        }
        addHeader(table, payment.getSens() == com.assurance.enums.SensMouvementTresorerie.SORTIE
                ? "BÉNÉFICIAIRE" : "PAYEUR", bold, TextAlignment.LEFT);
        addHeader(table, "MOYENS", bold, TextAlignment.CENTER);
        addHeader(table, "STATUT", bold, TextAlignment.LEFT);
        addHeader(table, "MONTANT AFFECTÉ", bold, TextAlignment.RIGHT);

        int index = 0;
        for (AllocationSummary allocation : allocations.values()) {
            DeviceRgb background = index++ % 2 == 1 ? SOFT_BLUE : null;
            addBody(table, allocation.policyNumber, regular, TextAlignment.LEFT, background);
            addBody(table, allocation.movement, regular, TextAlignment.LEFT, background);
            if (showDocument) {
                addBody(table, allocation.document, regular, TextAlignment.LEFT, background);
            }
            addBody(table, allocation.payer, regular, TextAlignment.LEFT, background);
            addBody(table, String.valueOf(allocation.instrumentIds.size()), regular, TextAlignment.CENTER, background);
            addBody(table, allocationStatus(allocation.status), regular, TextAlignment.LEFT, background);
            addBody(table, amount(allocation.amount), bold, TextAlignment.RIGHT, background);
        }
        if (index == 0) {
            table.addCell(new Cell(1, columns.length)
                    .add(new Paragraph("Aucune affectation").setFont(regular).setFontSize(8).setMargin(0))
                    .setTextAlignment(TextAlignment.CENTER).setFontColor(MUTED)
                    .setBorder(new SolidBorder(BORDER, 0.45f)).setPadding(10));
        }
        table.addCell(totalLabelCell("TOTAL DU RÈGLEMENT (MAD)", columns.length - 1, bold));
        table.addCell(totalValueCell(amount(payment.getMontantTotal()), bold));
        document.add(table);
    }

    private Map<String, AllocationSummary> groupedAllocations(ReglementClient payment) {
        Map<String, AllocationSummary> grouped = new LinkedHashMap<>();
        Set<Long> assistanceIds = BillableReferences.assistanceElementIds(payment.getInstruments());
        Map<Long, String> assistanceNumbers = assistanceIds.isEmpty() ? Map.of() : BillableReferences.assistanceNumbers(
                assistanceRepository.findForPaymentHistory(payment.getAgence().getId(), assistanceIds));
        for (InstrumentReglementClient instrument : payment.getInstruments().stream()
                .sorted(Comparator.comparing(InstrumentReglementClient::getId))
                .toList()) {
            for (AffectationReglementClient allocation : instrument.getAffectations().stream()
                    .sorted(Comparator.comparing(AffectationReglementClient::getId))
                    .toList()) {
                String key = allocationTargetKey(allocation) + ":" + allocation.getStatut()
                        + ":" + value(allocation.getPayeurNomSnapshot());
                AllocationSummary summary = grouped.computeIfAbsent(key, ignored -> new AllocationSummary(
                        value(BillableReferences.allocation(allocation, assistanceNumbers)),
                        allocation.getElementFacturable() == null ? "Affectation globale au document"
                                : value(allocation.getElementFacturable().getLibelle()),
                        allocationDocument(allocation),
                        value(allocation.getPayeurNomSnapshot()),
                        allocation.getStatut()
                ));
                summary.amount = summary.amount.add(allocation.getMontant());
                summary.instrumentIds.add(instrument.getId());
            }
        }
        return grouped;
    }

    private String allocationTargetKey(AffectationReglementClient allocation) {
        String document = allocation.getDocumentClient() == null
                ? "" : "D:" + allocation.getDocumentClient().getId();
        String element = allocation.getElementFacturable() == null
                ? "" : "E:" + allocation.getElementFacturable().getId();
        return document + ":" + element;
    }

    private static final class AllocationSummary {
        private final String policyNumber;
        private final String movement;
        private final String document;
        private final String payer;
        private final StatutAffectationReglement status;
        private final Set<Long> instrumentIds = new LinkedHashSet<>();
        private BigDecimal amount = BigDecimal.ZERO;

        private AllocationSummary(
                String policyNumber,
                String movement,
                String document,
                String payer,
                StatutAffectationReglement status
        ) {
            this.policyNumber = policyNumber;
            this.movement = movement;
            this.document = document;
            this.payer = payer;
            this.status = status;
        }
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
            document.add(new Paragraph(payment.getSens() == com.assurance.enums.SensMouvementTresorerie.SORTIE
                            ? "Ce document confirme l'enregistrement de la ristourne. Le décaissement des moyens en attente reste à confirmer."
                            : "Ce document confirme l’enregistrement du règlement. Les instruments en attente ou remis en banque ne sont pas encore définitivement encaissés.")
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

    private String allocationDocument(AffectationReglementClient allocation) {
        DocumentClient clientDocument = allocation.getDocumentClient();
        if (clientDocument != null) {
            String documentLabel = switch (clientDocument.getTypeDocument()) {
                case FACTURE -> "Facture ";
                case RELEVE -> "Relevé ";
            };
            return documentLabel + value(clientDocument.getNumero());
        }
        return null;
    }

    private Paragraph sectionTitle(String text, PdfFont bold) {
        return new Paragraph(text).setFont(bold).setFontSize(10).setFontColor(ACCENT).setMarginBottom(7);
    }

    private Cell totalLabelCell(String label, int colspan, PdfFont bold) {
        return new Cell(1, colspan)
                .add(new Paragraph(label).setFont(bold).setFontSize(8.5f)
                        .setFontColor(INK).setMargin(0))
                .setTextAlignment(TextAlignment.RIGHT)
                .setBorder(new SolidBorder(BORDER, 0.45f))
                .setBackgroundColor(SOFT_ACCENT)
                .setPadding(5);
    }

    private Cell totalValueCell(String content, PdfFont bold) {
        return new Cell()
                .add(new Paragraph(content).setFont(bold).setFontSize(8.5f)
                        .setFontColor(INK).setMargin(0))
                .setTextAlignment(TextAlignment.RIGHT)
                .setBorder(new SolidBorder(BORDER, 0.45f))
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

    private String modeLabel(ModeReglementClient mode) {
        return switch (mode) {
            case ESPECES -> "Espèces";
            case CHEQUE -> "Chèque";
            case EFFET -> "Effet";
            case VIREMENT -> "Virement";
            case VERSEMENT_BANCAIRE -> "Versement bancaire";
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
