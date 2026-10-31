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
        return render(payment, reference, issuedOn, null);
    }

    public byte[] render(ReglementClient payment, String reference, LocalDate issuedOn, Set<String> policyKeys) {
        List<InstrumentReglementClient> instruments = payment.getInstruments().stream()
                .filter(i -> i.getStatut() != StatutInstrumentReglement.REMPLACE)
                .sorted(Comparator.comparing(InstrumentReglementClient::getId)).toList();
        if (instruments.isEmpty()) {
            throw new BadRequestException("Régularisez les moyens impayés avant d'émettre la quittance de prime");
        }
        BigDecimal received = instruments.stream().map(InstrumentReglementClient::getMontant).reduce(BigDecimal.ZERO, BigDecimal::add);
        if (received.compareTo(payment.getMontantTotal()) != 0) {
            throw new BadRequestException("Le total des moyens actifs est incohérent avec le règlement");
        }
        for (InstrumentReglementClient instrument : instruments) {
            BigDecimal instrumentAllocated = instrument.getAffectations().stream()
                    .filter(a -> a.getStatut() != StatutAffectationReglement.ANNULEE)
                    .map(AffectationReglementClient::getMontant).reduce(BigDecimal.ZERO, BigDecimal::add);
            if (instrumentAllocated.signum() < 0 || instrumentAllocated.compareTo(instrument.getMontant()) > 0) {
                throw new BadRequestException("Les affectations dépassent le montant d'un moyen de règlement");
            }
        }
        List<PrimeRow> rows = rows(payment, instruments);
        Map<Long, AssistanceContrat> assistance = assistance(payment, rows);
        if (policyKeys != null) {
            Set<String> available = new LinkedHashSet<>();
            rows.forEach(row -> available.add(row.selectionKey()));
            if (policyKeys.isEmpty() || !available.containsAll(policyKeys)) {
                throw new BadRequestException("Sélection de polices invalide pour ce règlement");
            }
            rows = rows.stream().filter(row -> policyKeys.contains(row.selectionKey())).toList();
        }
        if (instruments.stream().anyMatch(i -> i.getStatut() == StatutInstrumentReglement.REJETE
                && (policyKeys == null || selectedAmount(i, policyKeys).signum() > 0))) {
            throw new BadRequestException("Régularisez les moyens impayés avant d'émettre la quittance de prime");
        }
        BigDecimal allocated = rows.stream().map(row -> row.applied).reduce(BigDecimal.ZERO, BigDecimal::add);
        if (allocated.compareTo(received) > 0) throw new BadRequestException("Les affectations dépassent le montant du règlement");
        BigDecimal receiptTotal = policyKeys == null ? received : allocated;
        if (policyKeys != null && receiptTotal.signum() <= 0) {
            throw new BadRequestException("La sélection ne comporte aucun montant à quittancer");
        }

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
            String companies = String.join(" · ", rows.stream().flatMap(row -> row.elements().stream()
                    .map(e -> row.company(e, assistance.get(e.getId())))).distinct().toList());
            if (!companies.isBlank()) {
                document.add(new Paragraph("Assureur(s) : " + companies).setFontSize(7).setMarginTop(5).setMarginBottom(8));
            }
            Table detail = new Table(new float[]{1.5f, 2.5f, 1, 1, 1, 1, 1}).useAllAvailableWidth();
            for (String column : List.of("CATÉGORIE", "N° POLICE", "PRIME NETTE", "TAXES / TPF", "ACC. / CNPAC", "PRIME TOTALE", "MONTANT RÉGLÉ")) {
                detail.addHeaderCell(new Cell().add(new Paragraph(column).setFont(bold).setFontSize(6).setMargin(0))
                        .setBackgroundColor(HEADER).setFontColor(ColorConstants.WHITE).setPadding(5));
            }
            for (PrimeRow row : rows) {
                add(detail, row.branchNames(assistance), normal, false);
                add(detail, row.policyNumbers(assistance), normal, false);
                add(detail, amount(row.net()), normal, true);
                add(detail, amount(row.taxes()), normal, true);
                add(detail, amount(row.fees()), normal, true);
                add(detail, amount(row.total()), normal, true);
                add(detail, amount(row.applied), bold, true);
            }
            if (rows.isEmpty()) detail.addCell(new Cell(1, 7).add(new Paragraph("Aucune prime affectée : acompte non affecté").setMargin(0)).setPadding(7));
            detail.addCell(new Cell(1, 6).add(new Paragraph("TOTAL AFFECTÉ").setFont(bold).setMargin(0))
                    .setTextAlignment(TextAlignment.RIGHT).setBackgroundColor(PALE).setPadding(5));
            add(detail, amount(allocated), bold, true);
            document.add(detail);
            document.add(new Paragraph("Les primes totales sont les montants des créances concernées. Le montant réglé correspond uniquement à la part affectée par ce règlement.")
                    .setFontSize(7).setMarginTop(5));
            document.add(new Paragraph(policyKeys == null ? "Moyen(s) de règlement" : "Moyen(s) de règlement · Part affectée à la sélection")
                    .setFont(bold).setMarginTop(12).setMarginBottom(4));
            for (InstrumentReglementClient i : instruments) {
                BigDecimal instrumentAmount = policyKeys == null ? i.getMontant() : selectedAmount(i, policyKeys);
                if (instrumentAmount.signum() == 0) continue;
                String instrumentDate = switch (i.getMode()) {
                    case CHEQUE -> label("Date du chèque", i.getDateInstrument() == null ? null : date(i.getDateInstrument()));
                    case EFFET -> label("Échéance", i.getDateEcheance() == null ? null : date(i.getDateEcheance()));
                    default -> label("Date", i.getDateInstrument() == null ? null : date(i.getDateInstrument()));
                };
                document.add(new Paragraph(join(mode(i), label("N°", i.getReferenceInstrument()),
                        i.getBanqueEmettriceReference() == null ? null : i.getBanqueEmettriceReference().getLibelle(),
                        instrumentDate, amount(instrumentAmount) + " MAD")).setFontSize(8).setMarginTop(0).setMarginBottom(4));
            }
            BigDecimal confirmed = instruments.stream().filter(i -> i.getStatut() == StatutInstrumentReglement.CONFIRME)
                    .map(i -> policyKeys == null ? i.getMontant() : selectedAmount(i, policyKeys)).reduce(BigDecimal.ZERO, BigDecimal::add);
            document.add(new Paragraph("Total : " + amount(receiptTotal) + " MAD")
                    .setFont(bold).setFontSize(11).setTextAlignment(TextAlignment.RIGHT).setMarginTop(12).setMarginBottom(4));
            if (receiptTotal.compareTo(confirmed) > 0) {
                document.add(new Paragraph("Dont sous réserve d'encaissement : " + amount(receiptTotal.subtract(confirmed)) + " MAD")
                        .setFontSize(7).setTextAlignment(TextAlignment.RIGHT).setMargin(0));
            }
            if (policyKeys == null && received.compareTo(allocated) > 0) {
                document.add(new Paragraph("Dont acompte non affecté : " + amount(received.subtract(allocated)) + " MAD")
                        .setFontSize(7).setTextAlignment(TextAlignment.RIGHT).setMargin(0));
            }
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

    public List<PolicyOption> policies(ReglementClient payment) {
        List<InstrumentReglementClient> instruments = payment.getInstruments().stream()
                .filter(i -> i.getStatut() != StatutInstrumentReglement.REMPLACE).toList();
        List<PrimeRow> rows = rows(payment, instruments);
        Map<Long, AssistanceContrat> assistance = assistance(payment, rows);
        Map<String, List<PrimeRow>> grouped = new LinkedHashMap<>();
        rows.forEach(row -> grouped.computeIfAbsent(row.selectionKey(), ignored -> new ArrayList<>()).add(row));
        return grouped.entrySet().stream().map(entry -> new PolicyOption(entry.getKey(),
                entry.getValue().stream().map(row -> row.description(assistance)).distinct().toList(),
                entry.getValue().stream().map(row -> row.applied).reduce(BigDecimal.ZERO, BigDecimal::add)))
                .toList();
    }

    private Map<Long, AssistanceContrat> assistance(ReglementClient payment, List<PrimeRow> rows) {
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
        return assistance;
    }

    private static BigDecimal selectedAmount(InstrumentReglementClient instrument, Set<String> policyKeys) {
        return instrument.getAffectations().stream()
                .filter(a -> a.getStatut() != StatutAffectationReglement.ANNULEE)
                .filter(a -> policyKeys.contains(new PrimeRow(a.getElementFacturable(), a.getDocumentClient()).selectionKey()))
                .map(AffectationReglementClient::getMontant).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    public record PolicyOption(String key, List<String> descriptions, BigDecimal montant) {
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
                .add(new Paragraph("N° " + reference).setFont(bold).setMarginTop(5).setMarginBottom(0)));
        document.add(header);
        Table identity = new Table(new float[]{1.15f, 2.5f, 1.25f, 1.8f}).useAllAvailableWidth().setMarginTop(12).setKeepTogether(true);
        addIdentity(identity, "Payeur", value(payment.getPayeurNom()), "Date d'émission", date(issuedOn), normal, bold);
        addIdentity(identity, "Adresse", payerAddress(payment), "Réf. règlement", value(payment.getNumero()), normal, bold);
        addIdentity(identity, "Intermédiaire", value(payment.getAgence().getNom()), "Date du règlement", date(payment.getDateReglement()), normal, bold);
        document.add(identity);
    }

    private static void addIdentity(Table table, String leftLabel, String leftValue, String rightLabel, String rightValue,
                                    PdfFont normal, PdfFont bold) {
        add(table, leftLabel, bold, false);
        add(table, leftValue, normal, false);
        add(table, rightLabel, bold, false);
        add(table, rightValue, normal, false);
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

        private String selectionKey() {
            if (element == null && document != null) return "D:" + document.getId();
            if (element != null && element.getNature() == com.assurance.enums.NatureElementFacturable.ASSISTANCE) {
                return "A:" + element.getId();
            }
            if (element == null || element.getContrat() == null || element.getContrat().getId() == null) {
                throw new BadRequestException("La police de l'affectation est introuvable");
            }
            return "C:" + element.getContrat().getId();
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
                descriptions.add(policyNumber(e, a) + "\n" + company(e, a));
            }
            return String.join("\n", descriptions);
        }

        private String policyNumber(ElementFacturable element, AssistanceContrat assistance) {
            String policy = assistance == null ? element.getContrat().getNumeroPolice()
                    : first(assistance.getNumeroPoliceContrat(), assistance.getNumeroContratOuQuittance());
            if (document != null) {
                var snapshot = lines().stream().filter(l -> l.getElementFacturable().getId().equals(element.getId())).findFirst().orElseThrow();
                policy = first(snapshot.getNumeroPolice(), policy);
            }
            return value(policy);
        }

        private String company(ElementFacturable element, AssistanceContrat assistance) {
            String company = assistance != null && assistance.getCompagnieAssistance() != null ? assistance.getCompagnieAssistance().getNom()
                    : element.getCompagnieAssurance() != null ? element.getCompagnieAssurance().getNom()
                    : element.getContrat().getCompagnieAssurance() == null ? null : element.getContrat().getCompagnieAssurance().getNom();
            if (document != null) {
                var snapshot = lines().stream().filter(l -> l.getElementFacturable().getId().equals(element.getId())).findFirst().orElseThrow();
                company = first(snapshot.getCompagnie(), company);
            }
            return value(company);
        }

        private String policyNumbers(Map<Long, AssistanceContrat> assistance) {
            return String.join("\n", elements().stream().map(e -> policyNumber(e, assistance.get(e.getId()))).distinct().toList());
        }

        private String branchNames(Map<Long, AssistanceContrat> assistance) {
            List<String> descriptions = new ArrayList<>();
            for (ElementFacturable e : elements()) {
                AssistanceContrat a = assistance.get(e.getId());
                String branch = a != null && a.getBrancheAssurance() != null ? a.getBrancheAssurance().getLibelle()
                        : e.getContrat().getBrancheAssurance() == null ? null : e.getContrat().getBrancheAssurance().getLibelle();
                descriptions.add(value(branch));
            }
            return String.join("\n", descriptions.stream().distinct().toList());
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
