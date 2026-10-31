package com.assurance.service;

import com.assurance.entity.*;
import com.assurance.enums.StatutAffectationReglement;
import com.assurance.enums.StatutInstrumentReglement;
import com.assurance.exception.BadRequestException;
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
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class QuittancePrimePdfService {
    private static final DeviceRgb INK = new DeviceRgb(17, 48, 78);
    private static final DeviceRgb HEADER = new DeviceRgb(35, 78, 116);
    private static final DeviceRgb BORDER = new DeviceRgb(157, 171, 184);
    private static final DeviceRgb PALE = new DeviceRgb(232, 244, 250);
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private final AgencyLogoStorageService logoStorage;
    private final AssistanceContratRepository assistanceRepository;

    public byte[] render(ReglementClient payment, String reference, LocalDate issuedOn) {
        List<InstrumentReglementClient> instruments = payment.getInstruments().stream()
                .filter(i -> i.getStatut() != StatutInstrumentReglement.REMPLACE)
                .sorted(Comparator.comparing(InstrumentReglementClient::getId)).toList();
        if (instruments.isEmpty() || instruments.stream().anyMatch(i -> i.getStatut() == StatutInstrumentReglement.REJETE)) {
            throw new BadRequestException("Régularisez les moyens impayés avant d'émettre la quittance de prime");
        }
        BigDecimal received = instruments.stream().map(InstrumentReglementClient::getMontant).reduce(BigDecimal.ZERO, BigDecimal::add);
        if (received.compareTo(payment.getMontantTotal()) != 0) {
            throw new BadRequestException("Le total des moyens actifs est incohérent avec le règlement");
        }
        List<PrimeRow> rows = rows(payment, instruments);
        BigDecimal allocated = rows.stream().map(row -> row.applied).reduce(BigDecimal.ZERO, BigDecimal::add);
        if (allocated.compareTo(received) > 0) throw new BadRequestException("Les affectations dépassent le montant du règlement");
        Set<Long> ids = new LinkedHashSet<>();
        rows.forEach(row -> row.elements().forEach(e -> {
            if (e.getAgence() == null || !Objects.equals(e.getAgence().getId(), payment.getAgence().getId())) {
                throw new BadRequestException("Une prime n'appartient pas à l'agence");
            }
            ids.add(e.getId());
        }));
        Map<Long, AssistanceContrat> assistance = new HashMap<>();
        if (!ids.isEmpty()) assistanceRepository.findByElementFacturableIds(ids)
                .forEach(a -> assistance.put(a.getElementFacturable().getId(), a));

        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            PdfDocument pdf = new PdfDocument(new PdfWriter(out));
            Document document = new Document(pdf, PageSize.A4);
            document.setMargins(24, 24, 62, 24);
            PdfFont normal = PdfFontFactory.createFont(StandardFonts.HELVETICA);
            PdfFont bold = PdfFontFactory.createFont(StandardFonts.HELVETICA_BOLD);
            document.setFont(normal).setFontSize(8).setFontColor(INK);
            pdf.addEventHandler(com.itextpdf.kernel.events.PdfDocumentEvent.END_PAGE, event -> {
                var pageEvent = (com.itextpdf.kernel.events.PdfDocumentEvent) event;
                var page = pageEvent.getPage();
                PdfCanvas canvas = new PdfCanvas(page.newContentStreamAfter(), page.getResources(), pdf);
                canvas.setStrokeColor(HEADER).setLineWidth(0.5f).moveTo(24, 48).lineTo(571, 48).stroke();
                Canvas footer = new Canvas(canvas, pdf, new Rectangle(24, 9, 547, 35));
                Agence agency = payment.getAgence();
                footer.add(new Paragraph(join(agency.getNom(), agency.getAdresse(), agency.getVille(), agency.getTelephone(), agency.getEmail())
                        + "\n" + join(label("ICE", agency.getIce()), label("IF", agency.getIdentifiantFiscal()), label("Agrément", agency.getNumeroAgrement()))
                        + "\n" + reference + " · Page " + pdf.getPageNumber(page))
                        .setFont(normal).setFontSize(6).setTextAlignment(TextAlignment.CENTER).setMargin(0));
                footer.close();
            });
            writeHeader(document, payment, reference, issuedOn, normal, bold);
            Table detail = new Table(new float[]{2.5f, 1.05f, 0.85f, 0.8f, 0.8f, 0.95f, 1f}).useAllAvailableWidth();
            for (String column : List.of("POLICE / ASSUREUR", "PÉRIODE", "PRIME NETTE", "TAXES / TPF", "FRAIS / CNPAC", "PRIME TTC", "VERSEMENT")) {
                detail.addHeaderCell(new Cell().add(new Paragraph(column).setFont(bold).setFontSize(6).setMargin(0))
                        .setBackgroundColor(HEADER).setFontColor(ColorConstants.WHITE).setPadding(5));
            }
            for (PrimeRow row : rows) {
                add(detail, row.description(assistance), normal, false);
                add(detail, row.period(), normal, false);
                add(detail, amount(row.net()), normal, true);
                add(detail, amount(row.taxes()), normal, true);
                add(detail, amount(row.fees()), normal, true);
                add(detail, amount(row.total()), normal, true);
                add(detail, amount(row.applied), bold, true);
            }
            if (rows.isEmpty()) detail.addCell(new Cell(1, 7).add(new Paragraph("Aucune prime affectée : acompte non affecté").setMargin(0)).setPadding(7));
            detail.addCell(new Cell(1, 6).add(new Paragraph("TOTAL IMPUTÉ AUX PRIMES").setFont(bold).setMargin(0))
                    .setTextAlignment(TextAlignment.RIGHT).setBackgroundColor(PALE).setPadding(5));
            add(detail, amount(allocated), bold, true);
            document.add(new Paragraph("Détail des primes · Montants en MAD").setFont(bold).setMarginTop(12));
            document.add(detail);
            document.add(new Paragraph("Les primes TTC ci-dessus sont les montants des créances concernées. La colonne Versement correspond uniquement au présent règlement.")
                    .setFontSize(7).setMarginTop(5));
            document.add(new Paragraph("Moyens de règlement").setFont(bold).setMarginTop(12));
            Table methods = new Table(new float[]{1.2f, 1.7f, 1.6f, 1f, 1.1f}).useAllAvailableWidth();
            for (String name : List.of("MODE", "RÉFÉRENCE", "BANQUE", "DATE", "MONTANT (MAD)")) {
                methods.addHeaderCell(new Cell().add(new Paragraph(name).setFont(bold).setFontSize(6).setMargin(0)).setBackgroundColor(PALE).setPadding(5));
            }
            for (InstrumentReglementClient i : instruments) {
                add(methods, mode(i), normal, false);
                add(methods, value(i.getReferenceInstrument()), normal, false);
                add(methods, i.getBanqueEmettriceReference() == null ? "-" : i.getBanqueEmettriceReference().getLibelle(), normal, false);
                add(methods, date(i.getDateEcheance() == null ? i.getDateInstrument() : i.getDateEcheance()), normal, false);
                add(methods, amount(i.getMontant()), bold, true);
            }
            document.add(methods);
            BigDecimal confirmed = instruments.stream().filter(i -> i.getStatut() == StatutInstrumentReglement.CONFIRME)
                    .map(InstrumentReglementClient::getMontant).reduce(BigDecimal.ZERO, BigDecimal::add);
            Table totals = new Table(new float[]{3, 1}).useAllAvailableWidth().setMarginTop(12);
            for (var total : List.of(Map.entry("Montant du règlement", received), Map.entry("Dont encaissé", confirmed),
                    Map.entry("Dont sous réserve d'encaissement", received.subtract(confirmed)), Map.entry("Dont acompte non affecté", received.subtract(allocated)))) {
                add(totals, total.getKey(), bold, false);
                add(totals, amount(total.getValue()) + " MAD", bold, true);
            }
            document.add(totals);
            document.add(new Paragraph("Reçu établi par le cabinet pour le règlement référencé, dans la limite des montants imputés. "
                    + "Les valeurs non définitivement encaissées sont reçues sous réserve d'encaissement. "
                    + "Ce document ne vaut ni attestation d'assurance ni confirmation du règlement intégral des polices.")
                    .setFontSize(7).setMarginTop(10));
            document.add(new Paragraph("Cachet et signature du cabinet").setFont(bold).setTextAlignment(TextAlignment.RIGHT).setMarginTop(20).setMarginBottom(25));
            document.close();
            return out.toByteArray();
        } catch (java.io.IOException error) {
            throw new BadRequestException("La génération de la quittance de prime a échoué");
        }
    }

    private void writeHeader(Document document, ReglementClient payment, String reference, LocalDate issuedOn, PdfFont normal, PdfFont bold) {
        Table header = new Table(new float[]{1, 2}).useAllAvailableWidth();
        Cell brand = new Cell().setBorder(Border.NO_BORDER);
        byte[] logo = logoStorage.loadBytesIfPresent(payment.getAgence().getLogoCheminStockage());
        if (logo != null && logo.length > 0) brand.add(new Image(ImageDataFactory.create(logo)).scaleToFit(155, 58));
        else brand.add(new Paragraph(payment.getAgence().getNom()).setFont(bold).setFontSize(14));
        header.addCell(brand);
        header.addCell(new Cell().setBorder(Border.NO_BORDER).setTextAlignment(TextAlignment.RIGHT)
                .add(new Paragraph("QUITTANCE DE PRIME").setFont(bold).setFontSize(17).setMargin(0))
                .add(new Paragraph("Reçu de règlement émis par le cabinet").setFontSize(8).setMargin(0))
                .add(new Paragraph("N° " + reference).setFont(bold).setMarginTop(5).setMarginBottom(0))
                .add(new Paragraph("Date d'émission : " + date(issuedOn)).setMargin(0)));
        document.add(header);
        Table identity = new Table(new float[]{1.6f, 1}).useAllAvailableWidth().setMarginTop(10);
        add(identity, "REÇU DE\n" + value(payment.getPayeurNom()) + "\n" + payerAddress(payment), normal, false);
        add(identity, "RÈGLEMENT\n" + payment.getNumero() + "\nDate : " + date(payment.getDateReglement()), normal, false);
        document.add(identity);
    }

    private List<PrimeRow> rows(ReglementClient payment, List<InstrumentReglementClient> instruments) {
        Map<String, PrimeRow> grouped = new LinkedHashMap<>();
        for (InstrumentReglementClient instrument : instruments) {
            for (AffectationReglementClient a : instrument.getAffectations().stream()
                    .filter(item -> item.getStatut() != StatutAffectationReglement.ANNULEE)
                    .sorted(Comparator.comparing(AffectationReglementClient::getId)).toList()) {
                ElementFacturable element = a.getElementFacturable();
                DocumentClient source = a.getDocumentClient();
                if ((element != null && (element.getAgence() == null || !Objects.equals(element.getAgence().getId(), payment.getAgence().getId())))
                        || (source != null && (source.getAgence() == null || !Objects.equals(source.getAgence().getId(), payment.getAgence().getId())))) {
                    throw new BadRequestException("Une affectation n'appartient pas à l'agence");
                }
                if (element == null && source == null) throw new BadRequestException("Source de prime introuvable");
                String key = (source == null ? "" : "D" + source.getId()) + ":" + (element == null ? "" : "E" + element.getId());
                PrimeRow row = grouped.computeIfAbsent(key, ignored -> new PrimeRow(element, source));
                row.applied = row.applied.add(a.getMontant());
            }
        }
        return List.copyOf(grouped.values());
    }

    private static class PrimeRow {
        private final ElementFacturable element;
        private final DocumentClient document;
        private BigDecimal applied = BigDecimal.ZERO;
        private PrimeRow(ElementFacturable element, DocumentClient document) {
            this.element = element;
            this.document = document;
        }
        private List<LigneDocumentClient> lines() {
            if (document == null) return List.of();
            List<LigneDocumentClient> lines = document.getLignes().stream()
                    .filter(l -> element == null || Objects.equals(l.getElementFacturable().getId(), element.getId()))
                    .sorted(Comparator.comparing(LigneDocumentClient::getOrdre)).toList();
            if (lines.isEmpty()) throw new BadRequestException("Les lignes du document source sont introuvables");
            return lines;
        }
        private List<ElementFacturable> elements() {
            return document == null ? List.of(element) : lines().stream().map(LigneDocumentClient::getElementFacturable).toList();
        }
        private String description(Map<Long, AssistanceContrat> assistance) {
            List<String> descriptions = new ArrayList<>();
            if (document != null) descriptions.add("Document " + document.getNumero());
            for (ElementFacturable e : elements()) {
                AssistanceContrat a = assistance.get(e.getId());
                String policy = a == null ? e.getContrat().getNumeroPolice() : first(a.getNumeroPoliceContrat(), a.getNumeroContratOuQuittance());
                String company = a != null && a.getCompagnieAssistance() != null ? a.getCompagnieAssistance().getNom()
                        : e.getCompagnieAssurance() != null ? e.getCompagnieAssurance().getNom()
                        : e.getContrat().getCompagnieAssurance() == null ? null : e.getContrat().getCompagnieAssurance().getNom();
                if (document != null) {
                    var snapshot = lines().stream().filter(l -> l.getElementFacturable().getId().equals(e.getId())).findFirst().orElseThrow();
                    policy = first(snapshot.getNumeroPolice(), policy);
                    company = first(snapshot.getCompagnie(), company);
                }
                String branch = a != null && a.getBrancheAssurance() != null ? a.getBrancheAssurance().getLibelle()
                        : e.getContrat().getBrancheAssurance() == null ? null : e.getContrat().getBrancheAssurance().getLibelle();
                descriptions.add(join(value(policy), company, branch, e.getLibelle()));
            }
            return String.join("\n", descriptions);
        }
        private String period() {
            return String.join("\n", elements().stream().map(e -> date(e.getDateDebut()) + "\n" + date(e.getDateFin())).distinct().toList());
        }
        private BigDecimal net() {
            return document == null ? element.getPrimeNette() : sum(lines().stream().map(LigneDocumentClient::getPrimeNette).toList());
        }
        private BigDecimal taxes() {
            return document == null ? sum(Arrays.asList(element.getTaxe(), element.getTaxeParafiscale()))
                    : sum(lines().stream().map(LigneDocumentClient::getTaxes).toList());
        }
        private BigDecimal fees() {
            return document == null ? sum(Arrays.asList(element.getAccessoire(), element.getCnpac()))
                    : sum(lines().stream().map(LigneDocumentClient::getAccessoires).toList());
        }
        private BigDecimal total() {
            return document == null ? element.getPrimeTotale() : sum(lines().stream().map(LigneDocumentClient::getMontantTtc).toList());
        }
    }

    private static void add(Table table, String text, PdfFont font, boolean right) {
        table.addCell(new Cell().add(new Paragraph(value(text)).setFont(font).setFontSize(7).setMargin(0))
                .setTextAlignment(right ? TextAlignment.RIGHT : TextAlignment.LEFT).setPadding(5).setBorder(new SolidBorder(BORDER, 0.5f)));
    }
    private static BigDecimal sum(List<BigDecimal> values) {
        return values.stream().allMatch(Objects::isNull) ? null
                : values.stream().filter(Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
    }
    private static String amount(BigDecimal amount) {
        return amount == null ? "-" : new DecimalFormat("#,##0.00", DecimalFormatSymbols.getInstance(Locale.FRANCE))
                .format(amount).replace('\u202f', ' ').replace('\u00a0', ' ');
    }
    private static String date(LocalDate date) {
        return date == null ? "-" : DATE.format(date);
    }
    private static String value(String text) {
        return text == null || text.isBlank() ? "-" : text;
    }
    private static String first(String a, String b) {
        return a == null || a.isBlank() ? b : a;
    }
    private static String label(String label, String value) {
        return value == null || value.isBlank() ? null : label + " : " + value;
    }
    private static String join(String... parts) {
        return String.join(" · ", Arrays.stream(parts).filter(s -> s != null && !s.isBlank()).toList());
    }
    private static String payerAddress(ReglementClient payment) {
        Client payer = payment.getClientPayeur();
        if (payer == null && payment.getGroupePayeur() != null) payer = payment.getGroupePayeur().getClientTresorerie();
        return payer == null ? "-" : value(payer.getAdresse());
    }
    private static String mode(InstrumentReglementClient i) {
        return switch (i.getMode()) {
            case ESPECES -> "Espèces";
            case CHEQUE -> "Chèque";
            case EFFET -> "Effet";
            case VIREMENT -> "Virement";
            case VERSEMENT_BANCAIRE -> "Versement bancaire";
        };
    }
}
