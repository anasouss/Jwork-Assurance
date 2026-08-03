package com.assurance.service;

import com.assurance.entity.AssistanceContrat;
import com.assurance.entity.Client;
import com.assurance.entity.Contrat;
import com.assurance.entity.ContratClient;
import com.assurance.entity.ContratGarantie;
import com.assurance.entity.Usage;
import com.assurance.entity.Vehicule;
import com.assurance.enums.RoleClientContrat;
import com.assurance.enums.StatutContrat;
import com.assurance.enums.TypeContrat;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.AssistanceContratRepository;
import com.assurance.repository.ContratGarantieRepository;
import com.assurance.repository.ContratRepository;
import com.assurance.repository.VehiculeRepository;
import com.itextpdf.io.font.constants.StandardFonts;
import com.itextpdf.kernel.colors.DeviceRgb;
import com.itextpdf.kernel.font.PdfFont;
import com.itextpdf.kernel.font.PdfFontFactory;
import com.itextpdf.kernel.geom.PageSize;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.borders.SolidBorder;
import com.itextpdf.layout.element.Cell;
import com.itextpdf.layout.element.Paragraph;
import com.itextpdf.layout.element.Table;
import com.itextpdf.layout.element.Text;
import com.itextpdf.layout.property.HorizontalAlignment;
import com.itextpdf.layout.property.TextAlignment;
import com.itextpdf.layout.property.UnitValue;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PreTermeFlottePdfService {

    private static final DeviceRgb ACCENT = new DeviceRgb(28, 55, 92);
    private static final DeviceRgb SOFT_BORDER = new DeviceRgb(215, 224, 236);
    private static final DeviceRgb SOFT_BG = new DeviceRgb(248, 250, 253);
    private static final DeviceRgb TITLE_BG = new DeviceRgb(245, 248, 252);
    private static final DeviceRgb TABLE_BORDER = new DeviceRgb(68, 68, 68);
    private static final DeviceRgb TABLE_HEADER_BG = new DeviceRgb(243, 246, 251);
    private static final DeviceRgb TABLE_ROW_ALT_BG = new DeviceRgb(249, 251, 254);
    private static final DeviceRgb GUARANTEE_HEADER_BG = new DeviceRgb(242, 246, 252);
    private static final DeviceRgb GUARANTEE_GROUP_BG = new DeviceRgb(236, 242, 250);
    private static final DeviceRgb SELECTED_BG = new DeviceRgb(232, 245, 233);
    private static final DeviceRgb ASSISTANCE_BG = new DeviceRgb(255, 248, 220);
    private static final DeviceRgb ASSISTANCE_VALUE_BG = new DeviceRgb(252, 250, 238);
    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final ContratRepository contratRepository;
    private final VehiculeRepository vehiculeRepository;
    private final ContratGarantieRepository contratGarantieRepository;
    private final AssistanceContratRepository assistanceContratRepository;
    private final QuittanceCalculService quittanceCalculService;
    private final RichTextPdfRenderer richTextPdfRenderer;

    @Transactional(readOnly = true)
    public byte[] generate(Long agenceId, Long draftId, boolean avecPrime) {
        Contrat draft = contratRepository.findByAgenceIdAndId(agenceId, draftId)
                .orElseThrow(() -> new ResourceNotFoundException("Contrat", draftId));
        validateDraft(draft);

        List<Vehicule> vehicules = sortedVehicules(
                vehiculeRepository.findActiveByContratIdOrderByCreatedAtAsc(draftId)
        );
        List<ContratGarantie> garanties = contratGarantieRepository.findActiveByContratId(draftId);
        List<AssistanceContrat> assistances = assistanceContratRepository
                .findByContratIdAndActifTrueOrderByCreatedAtDesc(draftId);
        Map<Long, List<ContratGarantie>> garantiesByVehicule = garantiesByVehicule(vehicules, garanties);
        Map<Long, BigDecimal> assistanceAmountByVehicule = assistanceAmountByVehicule(assistances);
        Map<Long, Set<String>> assistanceProductsByVehicule = assistanceProductsByVehicule(assistances);
        List<String> garantieCodes = garantieCodes(vehicules, garanties, assistances);
        Map<String, Integer> garantieOrder = garantieOrder(garantieCodes);

        try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            PdfDocument pdf = new PdfDocument(new PdfWriter(output));
            Document document = new Document(pdf, PageSize.A4.rotate());
            document.setMargins(18, 16, 18, 16);
            document.setFont(PdfFontFactory.createFont(StandardFonts.HELVETICA));

            writeHeader(document, draft, avecPrime);
            writeContext(document, draft, avecPrime);
            writeTarif(
                    document,
                    draft,
                    vehicules,
                    garantiesByVehicule,
                    assistanceAmountByVehicule,
                    assistanceProductsByVehicule,
                    garantieCodes,
                    avecPrime
            );
            writeLegend(document, garantieCodes, garantieOrder, garantieLabels(garanties));

            int sectionIndex = 2;
            if (writeFranchises(document, draft, vehicules, garantiesByVehicule, garantieCodes, sectionIndex)) {
                sectionIndex++;
            }
            writeAssistances(document, assistances, sectionIndex);

            document.close();
            return output.toByteArray();
        } catch (Exception exception) {
            throw new BadRequestException("Génération du pré-terme impossible");
        }
    }

    private void validateDraft(Contrat draft) {
        if (draft.getContratOrigine() == null || draft.getTypeContrat() != TypeContrat.FLOTTE) {
            throw new BadRequestException("Le pré-terme flotte est introuvable");
        }
        if (draft.getStatut() != StatutContrat.DRAFT || !Boolean.TRUE.equals(draft.getBrouillon())) {
            throw new BadRequestException("Le PDF pré-terme est disponible uniquement pour un brouillon enregistré");
        }
    }

    private void writeHeader(Document document, Contrat draft, boolean avecPrime) throws Exception {
        PdfFont bold = PdfFontFactory.createFont(StandardFonts.HELVETICA_BOLD);
        Table titleTable = new Table(new float[]{1})
                .setWidth(UnitValue.createPercentValue(62))
                .setHorizontalAlignment(HorizontalAlignment.CENTER);
        if (!avecPrime) {
            titleTable.setMarginTop(28);
        }
        Cell titleCell = new Cell()
                .setBackgroundColor(TITLE_BG)
                .setBorder(new SolidBorder(ACCENT, 1.3f))
                .setPaddingTop(6)
                .setPaddingBottom(6);

        if (avecPrime) {
            titleCell
                    .add(new Paragraph("PROPOSITION D'ASSURANCE")
                            .setFont(bold)
                            .setFontSize(13)
                            .setMargin(0)
                            .setTextAlignment(TextAlignment.CENTER)
                            .setFontColor(ACCENT))
                    .add(new Paragraph("FLOTTE AUTOMOBILE")
                            .setFont(bold)
                            .setFontSize(13)
                            .setMargin(0)
                            .setTextAlignment(TextAlignment.CENTER)
                            .setFontColor(ACCENT));
        } else {
            titleCell.add(new Paragraph("L'Etat du parc Flotte Automobile")
                    .setFont(bold)
                    .setFontSize(13)
                    .setMargin(0)
                    .setTextAlignment(TextAlignment.CENTER)
                    .setFontColor(ACCENT));
        }

        String police = value(draft.getNumeroPolice(), "").toUpperCase(Locale.ROOT);
        titleCell.add(new Paragraph("Police N°" + (police.isEmpty() ? "" : " " + police))
                .setFont(bold)
                .setFontSize(13)
                .setMarginTop(4)
                .setMarginBottom(0)
                .setTextAlignment(TextAlignment.CENTER)
                .setFontColor(ACCENT));
        titleTable.addCell(titleCell);
        document.add(titleTable);
        document.add(new Paragraph(" ").setMarginBottom(6));
    }

    private void writeContext(Document document, Contrat draft, boolean avecPrime) {
        Client client = resolveClient(draft);
        String agencyCity = draft.getAgence() == null ? "" : value(draft.getAgence().getVille(), "");
        String cityAndDate = (agencyCity.isEmpty() ? "" : agencyCity + " le ") + formatDateTime(draft.getCreatedAt());

        Table infoHeader = new Table(new float[]{6, 4}).setWidth(UnitValue.createPercentValue(100));
        infoHeader.addCell(new Cell()
                .add(new Paragraph()
                        .add(new Text("Assuré : ").setBold().setFontColor(ACCENT))
                        .add(client == null ? "" : clientLabel(client))
                        .setFontSize(10))
                .add(new Paragraph()
                        .add(new Text("Adresse : ").setBold().setFontColor(ACCENT))
                        .add(client == null ? "" : clientAddress(client))
                        .setFontSize(10))
                .setBorder(new SolidBorder(SOFT_BORDER, 0.9f))
                .setPadding(6));
        infoHeader.addCell(new Cell()
                .add(new Paragraph(cityAndDate).setFontSize(10))
                .setTextAlignment(TextAlignment.RIGHT)
                .setBorder(new SolidBorder(SOFT_BORDER, 0.9f))
                .setPadding(6));
        document.add(infoHeader);
        document.add(new Paragraph(" ").setMarginBottom(3));

        Cell introCell = new Cell()
                .add(new Paragraph("Messieurs,").setBold().setFontSize(10))
                .setBackgroundColor(SOFT_BG)
                .setBorder(new SolidBorder(SOFT_BORDER, 0.9f))
                .setPadding(6);
        if (avecPrime) {
            introCell
                    .add(new Paragraph("Nous avons l'honneur de vous communiquer ci-dessous notre proposition d'assurance automobile, correspondante à votre parc automobile, et ce pour la période :")
                            .setBold().setFontSize(10))
                    .add(new Paragraph("Du " + formatDate(draft.getDateEffet()) + "  Au " + formatDate(draft.getDateEcheance()))
                            .setBold().setFontSize(10).setFontColor(ACCENT));
        } else {
            introCell
                    .add(new Paragraph("Nous avons l'honneur de vous communiquer ci-dessous, pour validation, l'état de votre parc flotte automobile qui arrivera à son échéance le")
                            .setBold().setFontSize(10))
                    .add(new Paragraph("(" + formatDate(draft.getDateEcheance()) + ")")
                            .setBold().setFontSize(10).setFontColor(com.itextpdf.kernel.colors.ColorConstants.RED));
        }
        Table introBox = new Table(new float[]{1}).setWidth(UnitValue.createPercentValue(100));
        introBox.addCell(introCell);
        document.add(introBox);
        document.add(new Paragraph(" ").setMarginBottom(3));
        document.add(new Paragraph(avecPrime ? "I. Le tarif" : "I. L'état des véhicules et garanties assurées")
                .setBold().setFontSize(11));
        document.add(new Paragraph(" ").setMarginBottom(2));
    }

    private void writeTarif(
            Document document,
            Contrat draft,
            List<Vehicule> vehicules,
            Map<Long, List<ContratGarantie>> garantiesByVehicule,
            Map<Long, BigDecimal> assistanceAmountByVehicule,
            Map<Long, Set<String>> assistanceProductsByVehicule,
            List<String> garantieCodes,
            boolean avecPrime
    ) {
        boolean hasDcCapitalColumn = garantieCodes.contains("DC");
        int valuesColumnsCount = hasDcCapitalColumn ? 4 : 3;
        int guaranteeColumnsCount = Math.max(1, garantieCodes.size());
        int totalColumns = 6 + valuesColumnsCount + guaranteeColumnsCount + (avecPrime ? 1 : 0);
        float[] widths = new float[totalColumns];
        Arrays.fill(widths, 1.0f);
        widths[0] = 1.2f;
        widths[1] = 1.3f;
        widths[2] = 1.5f;
        widths[3] = 1.2f;
        widths[4] = 1.0f;
        widths[5] = 1.0f;
        if (avecPrime) {
            widths[totalColumns - 1] = 1.4f;
        }

        Table table = new Table(widths).setWidth(UnitValue.createPercentValue(100));
        table.addCell(headerCell("Usage", 2, 1));
        table.addCell(headerCell("Marque", 2, 1));
        table.addCell(headerCell("N°\nd'immatric", 2, 1));
        table.addCell(headerCell("Date de\nMC", 2, 1));
        table.addCell(headerCell("PF/PTC", 2, 1));
        table.addCell(headerCell("ENERGIE", 2, 1));
        table.addCell(headerCell("VALEURS", 1, valuesColumnsCount));
        table.addCell(headerCell("GARANTIES ASSUREES", 1, guaranteeColumnsCount)
                .setBackgroundColor(GUARANTEE_GROUP_BG));
        if (avecPrime) {
            table.addCell(headerCell("Montant total", 2, 1));
        }

        table.addCell(headerCell("Valeur à\nNeuf", 1, 1));
        table.addCell(headerCell("Valeur\nVénale", 1, 1));
        table.addCell(headerCell("Valeur des\nglaces", 1, 1));
        if (hasDcCapitalColumn) {
            table.addCell(headerCell("Capital\nDC", 1, 1));
        }
        if (garantieCodes.isEmpty()) {
            table.addCell(guaranteeCodeHeaderCell("-"));
        } else {
            garantieCodes.forEach(code -> table.addCell(guaranteeCodeHeaderCell(code)));
        }

        BigDecimal grandTotal = BigDecimal.ZERO;
        for (int rowIndex = 0; rowIndex < vehicules.size(); rowIndex++) {
            Vehicule vehicule = vehicules.get(rowIndex);
            DeviceRgb rowBackground = rowIndex % 2 == 0 ? null : TABLE_ROW_ALT_BG;
            List<ContratGarantie> vehicleGaranties = garantiesByVehicule.getOrDefault(vehicule.getId(), List.of());
            Map<String, List<ContratGarantie>> byCode = vehicleGaranties.stream()
                    .filter(this::isSelectedGarantie)
                    .collect(Collectors.groupingBy(
                            item -> item.getGarantie().getCode().toUpperCase(Locale.ROOT),
                            LinkedHashMap::new,
                            Collectors.toList()
                    ));
            BigDecimal vehicleTotal = totalToPay(draft, vehicleGaranties)
                    .add(assistanceAmountByVehicule.getOrDefault(vehicule.getId(), BigDecimal.ZERO));
            grandTotal = grandTotal.add(vehicleTotal);

            table.addCell(valueCell(usageLabel(draft, vehicule.getUsage()), TextAlignment.LEFT, rowBackground));
            table.addCell(valueCell(vehicule.getMarque() == null ? "" : value(vehicule.getMarque().getLibelle(), ""), TextAlignment.LEFT, rowBackground));
            table.addCell(valueCell(value(vehicule.getImmatriculation(), ""), TextAlignment.CENTER, rowBackground));
            table.addCell(valueCell(formatDate(vehicule.getDatePremiereCirculation()), TextAlignment.CENTER, rowBackground));
            table.addCell(valueCell(pfOrPtc(vehicule), TextAlignment.CENTER, rowBackground));
            table.addCell(valueCell(value(vehicule.getCarburant(), ""), TextAlignment.CENTER, rowBackground));
            table.addCell(valueCell(formatMoneyOrEmpty(vehicule.getValeurNeuf()), TextAlignment.RIGHT, rowBackground));
            table.addCell(valueCell(formatMoneyOrEmpty(vehicule.getValeurVenale()), TextAlignment.RIGHT, rowBackground));
            table.addCell(valueCell(formatMoneyOrEmpty(vehicule.getValeurGlace()), TextAlignment.RIGHT, rowBackground));
            if (hasDcCapitalColumn) {
                table.addCell(valueCell(formatMoneyOrEmpty(capitalFor(byCode.get("DC"))), TextAlignment.RIGHT, rowBackground));
            }

            if (garantieCodes.isEmpty()) {
                table.addCell(valueCell("-", TextAlignment.CENTER, rowBackground));
            } else {
                for (String code : garantieCodes) {
                    if ("ASSISTANCE".equals(code)) {
                        Set<String> products = assistanceProductsByVehicule.get(vehicule.getId());
                        String text = products == null || products.isEmpty() ? "" : String.join(" / ", products);
                        table.addCell(valueCell(text, TextAlignment.CENTER, text.isEmpty() ? rowBackground : ASSISTANCE_VALUE_BG));
                        continue;
                    }
                    List<ContratGarantie> details = byCode.get(code);
                    boolean selected = details != null && !details.isEmpty();
                    table.addCell(guaranteeStateCell(selected ? markerFor(code, details) : "", rowBackground));
                }
            }
            if (avecPrime) {
                table.addCell(valueCell(formatMoney(vehicleTotal), TextAlignment.RIGHT, rowBackground));
            }
        }

        if (avecPrime) {
            table.addCell(new Cell(1, totalColumns - 1)
                    .add(new Paragraph("TOTAL").setBold())
                    .setTextAlignment(TextAlignment.CENTER)
                    .setBorder(new SolidBorder(TABLE_BORDER, 1.2f)));
            table.addCell(valueCell(formatMoney(grandTotal), TextAlignment.RIGHT, null).setBold());
        }
        document.add(table);
        document.add(new Paragraph(" "));
    }

    private void writeLegend(
            Document document,
            List<String> garantieCodes,
            Map<String, Integer> order,
            Map<String, String> labels
    ) {
        if (garantieCodes.isEmpty() || order.isEmpty()) {
            return;
        }
        Paragraph legend = new Paragraph()
                .setFontSize(7)
                .setTextAlignment(TextAlignment.LEFT)
                .setMarginTop(3)
                .setMarginBottom(6);
        int count = 0;
        for (String code : garantieCodes) {
            if ("ASSISTANCE".equals(code) || !order.containsKey(code)) {
                continue;
            }
            if (count > 0) {
                legend.add("   |   ");
            }
            legend.add(new Text(code));
            legend.add(new Text(String.valueOf(order.get(code))).setTextRise(2.8f).setFontSize(5.8f));
            legend.add(new Text(": " + value(labels.get(code), code)));
            count++;
        }
        if (count > 0) {
            document.add(legend);
        }
    }

    private boolean writeFranchises(
            Document document,
            Contrat draft,
            List<Vehicule> vehicules,
            Map<Long, List<ContratGarantie>> garantiesByVehicule,
            List<String> garantieCodes,
            int sectionIndex
    ) {
        List<Usage> usages = vehicules.stream()
                .map(Vehicule::getUsage)
                .filter(usage -> usage != null)
                .collect(Collectors.collectingAndThen(
                        Collectors.toMap(Usage::getId, usage -> usage, (left, right) -> left, LinkedHashMap::new),
                        map -> new ArrayList<>(map.values())
                ));
        usages.sort(Comparator.comparing(usage -> value(usage.getCode(), ""), String.CASE_INSENSITIVE_ORDER));

        List<String> codesWithFranchise = garantieCodes.stream()
                .filter(code -> !"RC".equals(code))
                .filter(code -> !"ASSISTANCE".equals(code))
                .filter(code -> usages.stream().anyMatch(usage -> hasFranchise(usage, code, vehicules, garantiesByVehicule)))
                .toList();
        if (usages.isEmpty() || codesWithFranchise.isEmpty()) {
            return false;
        }

        document.add(new Paragraph(toRoman(sectionIndex) + ". Les franchises")
                .setBold().setFontSize(11).setKeepWithNext(true));
        float[] widths = new float[1 + usages.size()];
        Arrays.fill(widths, 1.0f);
        widths[0] = 1.5f;
        Table table = new Table(widths)
                .setWidth(UnitValue.createPercentValue(35))
                .setKeepTogether(true);
        table.addCell(headerCell("Garanties", 1, 1));
        for (Usage usage : usages) {
            String code = value(usage.getCode(), "");
            String label = usageLabel(draft, usage);
            table.addCell(headerCell(isLocationCategory(draft) ? label : "Usage " + value(code, label), 1, 1));
        }

        for (int rowIndex = 0; rowIndex < codesWithFranchise.size(); rowIndex++) {
            String code = codesWithFranchise.get(rowIndex);
            DeviceRgb rowBackground = rowIndex % 2 == 0 ? null : TABLE_ROW_ALT_BG;
            table.addCell(valueCell(code, TextAlignment.LEFT, rowBackground).setBold());
            for (Usage usage : usages) {
                String franchise = franchiseFor(usage, code, vehicules, garantiesByVehicule);
                table.addCell(valueCell(franchise.isEmpty() ? "-" : franchise, TextAlignment.CENTER, rowBackground));
            }
        }
        document.add(table);
        document.add(new Paragraph(" "));
        return true;
    }

    private void writeAssistances(Document document, List<AssistanceContrat> assistances, int sectionIndex) {
        Map<String, String> productsAndPrestations = new LinkedHashMap<>();
        for (AssistanceContrat assistance : assistances) {
            String product = assistanceProductName(assistance);
            if (product.isEmpty()) {
                continue;
            }
            String prestations = assistance.getProduitAssistance() == null
                    ? ""
                    : value(assistance.getProduitAssistance().getPrestations(), "");
            productsAndPrestations.putIfAbsent(product, prestations.isEmpty() ? "-" : prestations);
        }
        if (productsAndPrestations.isEmpty()) {
            return;
        }

        document.add(new Paragraph(toRoman(sectionIndex) + ". Les prestations d'assistance")
                .setBold().setFontSize(11).setKeepWithNext(true));
        Table table = new Table(new float[]{2, 6})
                .setWidth(UnitValue.createPercentValue(100))
                .setKeepTogether(true);
        table.addCell(headerCell("Produit", 1, 1));
        table.addCell(headerCell("Prestations", 1, 1));
        int rowIndex = 0;
        for (Map.Entry<String, String> entry : productsAndPrestations.entrySet()) {
            DeviceRgb rowBackground = rowIndex % 2 == 0 ? null : TABLE_ROW_ALT_BG;
            table.addCell(valueCell(entry.getKey(), TextAlignment.LEFT, rowBackground).setKeepTogether(true));
            table.addCell(richTextCell(entry.getValue(), rowBackground).setKeepTogether(true));
            rowIndex++;
        }
        document.add(table);
    }

    private Map<Long, List<ContratGarantie>> garantiesByVehicule(
            List<Vehicule> vehicules,
            List<ContratGarantie> garanties
    ) {
        Set<Long> vehicleIds = vehicules.stream().map(Vehicule::getId).collect(Collectors.toSet());
        Map<Long, List<ContratGarantie>> result = new LinkedHashMap<>();
        garanties.stream()
                .filter(item -> item.getVehicule() != null && vehicleIds.contains(item.getVehicule().getId()))
                .sorted(Comparator.comparing(
                        item -> item.getGarantie() == null ? null : item.getGarantie().getOrdreAffichage(),
                        Comparator.nullsLast(Integer::compareTo)
                ))
                .forEach(item -> result.computeIfAbsent(item.getVehicule().getId(), ignored -> new ArrayList<>()).add(item));
        return result;
    }

    private List<String> garantieCodes(
            List<Vehicule> vehicules,
            List<ContratGarantie> garanties,
            List<AssistanceContrat> assistances
    ) {
        Set<Long> vehicleIds = vehicules.stream().map(Vehicule::getId).collect(Collectors.toSet());
        Set<String> codes = garanties.stream()
                .filter(item -> item.getVehicule() != null && vehicleIds.contains(item.getVehicule().getId()))
                .filter(this::isSelectedGarantie)
                .sorted(Comparator.comparing(
                        item -> item.getGarantie().getOrdreAffichage(),
                        Comparator.nullsLast(Integer::compareTo)
                ))
                .map(item -> item.getGarantie().getCode().toUpperCase(Locale.ROOT))
                .collect(Collectors.toCollection(LinkedHashSet::new));
        boolean hasRc = codes.remove("RC");
        List<String> ordered = new ArrayList<>();
        if (hasRc) {
            ordered.add("RC");
        }
        ordered.addAll(codes);
        if (!assistances.isEmpty()) {
            ordered.add("ASSISTANCE");
        }
        return ordered;
    }

    private Map<String, String> garantieLabels(List<ContratGarantie> garanties) {
        Map<String, String> labels = new LinkedHashMap<>();
        garanties.stream()
                .filter(item -> item.getGarantie() != null && item.getGarantie().getCode() != null)
                .forEach(item -> labels.putIfAbsent(
                        item.getGarantie().getCode().toUpperCase(Locale.ROOT),
                        value(item.getGarantie().getLibelle(), "")
                ));
        labels.put("RC", "RESPONSABILITE CIVILE");
        labels.put("DR", "DEFENSE ET RECOURS");
        labels.put("RVE", "RACHAT DE LA VETUSTE");
        labels.put("V", "VOL");
        labels.put("I", "INCENDIE");
        labels.put("BG", "BRIS DE GLACES");
        labels.put("DV", "DOMMAGES AUX VEHICULES");
        labels.put("RF", "RACHAT FRANCHISE");
        labels.put("VOR", "VOL OPTIQUE ET RETROVISEUR");
        labels.put("BOR", "BRIS OPTIQUE ET RETROVISEUR");
        labels.put("BTP", "BRIS DE TOIT PANORAMIQUE");
        labels.put("PP", "PROTECTION PASSAGERS");
        labels.putIfAbsent("ASSISTANCE", "Assistance");
        return labels;
    }

    private Map<String, Integer> garantieOrder(List<String> codes) {
        Map<String, Integer> result = new LinkedHashMap<>();
        int index = 1;
        for (String code : codes) {
            if (!"ASSISTANCE".equals(code)) {
                result.put(code, index++);
            }
        }
        return result;
    }

    private Map<Long, BigDecimal> assistanceAmountByVehicule(List<AssistanceContrat> assistances) {
        Map<Long, BigDecimal> result = new LinkedHashMap<>();
        assistances.stream()
                .filter(item -> item.getVehicule() != null)
                .forEach(item -> result.merge(
                        item.getVehicule().getId(),
                        nullToZero(item.getPrimeTotale()),
                        BigDecimal::add
                ));
        return result;
    }

    private Map<Long, Set<String>> assistanceProductsByVehicule(List<AssistanceContrat> assistances) {
        Map<Long, Set<String>> result = new LinkedHashMap<>();
        for (AssistanceContrat assistance : assistances) {
            if (assistance.getVehicule() == null) {
                continue;
            }
            String product = assistanceProductName(assistance);
            if (!product.isEmpty()) {
                result.computeIfAbsent(assistance.getVehicule().getId(), ignored -> new LinkedHashSet<>()).add(product);
            }
        }
        return result;
    }

    private BigDecimal totalToPay(Contrat draft, List<ContratGarantie> garanties) {
        if (garanties.isEmpty()) {
            return BigDecimal.ZERO;
        }
        boolean hasRc = garanties.stream().anyMatch(this::isRc);
        return quittanceCalculService.calculer(draft, null, garanties, hasRc ? 1 : 0).primeTotale();
    }

    private boolean isSelectedGarantie(ContratGarantie item) {
        if (item == null || item.getGarantie() == null || item.getGarantie().getCode() == null) {
            return false;
        }
        // In the new model, only selected guarantees are persisted in contrat_garanties.
        return item.getActif() == null || Boolean.TRUE.equals(item.getActif());
    }

    private boolean isRc(ContratGarantie item) {
        return item != null
                && item.getGarantie() != null
                && (Boolean.TRUE.equals(item.getGarantie().getResponsabiliteCivile())
                || "RC".equalsIgnoreCase(value(item.getGarantie().getCode(), "")));
    }

    private boolean hasFranchise(
            Usage usage,
            String code,
            List<Vehicule> vehicules,
            Map<Long, List<ContratGarantie>> garantiesByVehicule
    ) {
        return vehicules.stream()
                .filter(vehicule -> sameUsage(usage, vehicule.getUsage()))
                .flatMap(vehicule -> garantiesByVehicule.getOrDefault(vehicule.getId(), List.of()).stream())
                .filter(item -> item.getGarantie() != null && code.equalsIgnoreCase(item.getGarantie().getCode()))
                .anyMatch(item -> nullToZero(item.getTauxFranchise()).compareTo(BigDecimal.ZERO) != 0
                        || nullToZero(item.getFranchiseMinimale()).compareTo(BigDecimal.ZERO) != 0);
    }

    private String franchiseFor(
            Usage usage,
            String code,
            List<Vehicule> vehicules,
            Map<Long, List<ContratGarantie>> garantiesByVehicule
    ) {
        return vehicules.stream()
                .filter(vehicule -> sameUsage(usage, vehicule.getUsage()))
                .flatMap(vehicule -> garantiesByVehicule.getOrDefault(vehicule.getId(), List.of()).stream())
                .filter(item -> item.getGarantie() != null && code.equalsIgnoreCase(item.getGarantie().getCode()))
                .map(this::franchiseText)
                .filter(text -> !text.isEmpty())
                .distinct()
                .collect(Collectors.joining("\n"));
    }

    private String franchiseText(ContratGarantie item) {
        BigDecimal rate = nullToZero(item.getTauxFranchise());
        BigDecimal minimum = nullToZero(item.getFranchiseMinimale());
        boolean hasRate = rate.compareTo(BigDecimal.ZERO) != 0;
        boolean hasMinimum = minimum.compareTo(BigDecimal.ZERO) != 0;
        if (hasRate && !hasMinimum) {
            return formatPercent(rate);
        }
        if (!hasRate && hasMinimum) {
            return formatMoney(minimum) + " DH";
        }
        return formatPercent(rate) + " avec minimum " + formatMoney(minimum) + " DH";
    }

    private String markerFor(String code, List<ContratGarantie> details) {
        if (!"DV".equals(code) || details == null || details.isEmpty()) {
            return "X";
        }
        ContratGarantie first = details.get(0);
        if (nullToZero(first.getTauxFranchise()).compareTo(BigDecimal.ZERO) != 0) {
            return "FR" + formatPercent(first.getTauxFranchise());
        }
        if (nullToZero(first.getFranchiseMinimale()).compareTo(BigDecimal.ZERO) != 0) {
            return "";
        }
        return "X";
    }

    private BigDecimal capitalFor(List<ContratGarantie> details) {
        if (details == null || details.isEmpty()) {
            return BigDecimal.ZERO;
        }
        return details.stream()
                .map(ContratGarantie::getCapital)
                .filter(value -> value != null && value.compareTo(BigDecimal.ZERO) != 0)
                .findFirst()
                .orElse(nullToZero(details.get(0).getCapital()));
    }

    private Client resolveClient(Contrat draft) {
        return draft.getClients() == null ? null : draft.getClients().stream()
                .filter(link -> link.getRole() == RoleClientContrat.SOUSCRIPTEUR)
                .map(ContratClient::getClient)
                .findFirst()
                .orElse(null);
    }

    private String clientLabel(Client client) {
        if (client.getRaisonSociale() != null && !client.getRaisonSociale().isBlank()) {
            return client.getRaisonSociale().trim();
        }
        String fullName = (value(client.getNom(), "") + " " + value(client.getPrenom(), "")).trim();
        if (!fullName.isEmpty()) {
            return fullName;
        }
        return value(client.getRc(), value(client.getCin(), ""));
    }

    private String clientAddress(Client client) {
        String address = value(client.getAdresse(), "");
        String city = client.getVille() == null ? "" : value(client.getVille().getNom(), "");
        if (!address.isEmpty() && !city.isEmpty()) {
            return address + ", " + city;
        }
        return !address.isEmpty() ? address : city;
    }

    private String usageLabel(Contrat draft, Usage usage) {
        if (usage == null) {
            return "";
        }
        String code = value(usage.getCode(), "");
        if (!code.isEmpty() && isLocationCategory(draft)) {
            return "LOCATION - " + code;
        }
        return value(code, usage.getLibelle());
    }

    private boolean isLocationCategory(Contrat draft) {
        Client client = resolveClient(draft);
        return client != null
                && client.getCategorieClient() != null
                && "LOCATION".equalsIgnoreCase(value(client.getCategorieClient().getCode(), ""));
    }

    private String pfOrPtc(Vehicule vehicule) {
        if (vehicule == null || vehicule.getUsage() == null) {
            return "";
        }
        Usage usage = vehicule.getUsage();
        if ("B1".equalsIgnoreCase(value(usage.getCode(), ""))) {
            return vehicule.getCategorieTransport() == null
                    ? ""
                    : value(vehicule.getCategorieTransport().getLibelle(), "");
        }
        if (Boolean.TRUE.equals(usage.getByPtc())) {
            return value(vehicule.getPtc(), "");
        }
        if (Boolean.TRUE.equals(usage.getBySousClasse())) {
            return value(vehicule.getSousClasse(), "");
        }
        return value(vehicule.getPuissanceFiscale(), "");
    }

    private String assistanceProductName(AssistanceContrat assistance) {
        if (assistance == null) {
            return "";
        }
        if (assistance.getProduit() != null && !assistance.getProduit().isBlank()) {
            return assistance.getProduit().trim();
        }
        return assistance.getProduitAssistance() == null
                ? ""
                : value(assistance.getProduitAssistance().getLibelle(), "");
    }

    private List<Vehicule> sortedVehicules(Collection<Vehicule> vehicules) {
        return vehicules.stream()
                .sorted(Comparator.comparing(
                                (Vehicule vehicule) -> vehicule.getUsage() == null
                                        ? ""
                                        : value(vehicule.getUsage().getCode(), vehicule.getUsage().getLibelle()),
                                String.CASE_INSENSITIVE_ORDER
                        )
                        .thenComparing(vehicule -> value(vehicule.getImmatriculation(), ""), String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(Vehicule::getId, Comparator.nullsLast(Long::compareTo)))
                .toList();
    }

    private Cell headerCell(String text, int rowSpan, int colSpan) {
        return new Cell(rowSpan, colSpan)
                .add(new Paragraph(safe(text)).setBold())
                .setTextAlignment(TextAlignment.CENTER)
                .setFontSize(8.5f)
                .setBackgroundColor(TABLE_HEADER_BG)
                .setBorder(new SolidBorder(TABLE_BORDER, 1))
                .setPadding(3);
    }

    private Cell guaranteeCodeHeaderCell(String code) {
        Cell cell = new Cell()
                .add(new Paragraph(safe(code)).setBold())
                .setTextAlignment(TextAlignment.CENTER)
                .setFontSize(8.5f)
                .setBorder(new SolidBorder(TABLE_BORDER, 1))
                .setPadding(3);
        return cell.setBackgroundColor("ASSISTANCE".equalsIgnoreCase(code) ? ASSISTANCE_BG : GUARANTEE_HEADER_BG);
    }

    private Cell guaranteeStateCell(String text, DeviceRgb rowBackground) {
        Cell cell = valueCell(text == null ? "" : text, TextAlignment.CENTER, rowBackground);
        if (text != null && !text.isEmpty()) {
            cell.setBold().setBackgroundColor(SELECTED_BG);
        }
        return cell;
    }

    private Cell valueCell(String text, TextAlignment alignment, DeviceRgb backgroundColor) {
        Cell cell = new Cell()
                .add(new Paragraph(safe(text)))
                .setFontSize(8.5f)
                .setTextAlignment(alignment)
                .setBorder(new SolidBorder(TABLE_BORDER, 1))
                .setPadding(3);
        if (backgroundColor != null) {
            cell.setBackgroundColor(backgroundColor);
        }
        return cell;
    }

    private Cell richTextCell(String text, DeviceRgb backgroundColor) {
        Cell cell = new Cell()
                .setFontSize(8.5f)
                .setTextAlignment(TextAlignment.LEFT)
                .setBorder(new SolidBorder(TABLE_BORDER, 1))
                .setPadding(3);
        richTextPdfRenderer.addTo(cell, text);
        if (backgroundColor != null) {
            cell.setBackgroundColor(backgroundColor);
        }
        return cell;
    }

    private boolean sameUsage(Usage left, Usage right) {
        return left != null && right != null && left.getId() != null && left.getId().equals(right.getId());
    }

    private BigDecimal nullToZero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private static String value(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    private static String formatDate(LocalDate date) {
        return date == null ? "" : date.format(DATE_FORMAT);
    }

    private static String formatDateTime(LocalDateTime date) {
        return date == null ? "" : date.format(DATE_FORMAT);
    }

    private static String formatMoneyOrEmpty(BigDecimal value) {
        return value == null || value.compareTo(BigDecimal.ZERO) == 0 ? "" : formatMoney(value);
    }

    private static String formatMoney(BigDecimal value) {
        DecimalFormatSymbols symbols = new DecimalFormatSymbols(Locale.FRANCE);
        symbols.setGroupingSeparator(' ');
        symbols.setDecimalSeparator(',');
        return new DecimalFormat("#,##0.##", symbols).format(value == null ? BigDecimal.ZERO : value);
    }

    private static String formatPercent(BigDecimal value) {
        return formatMoney(value) + "%";
    }

    private static String toRoman(int number) {
        return switch (number) {
            case 1 -> "I";
            case 2 -> "II";
            case 3 -> "III";
            case 4 -> "IV";
            default -> String.valueOf(number);
        };
    }

    private static String safe(String text) {
        String clean = (text == null ? "" : text)
                .replace('\u00A0', ' ')
                .replace('\u2007', ' ')
                .replace('\u2009', ' ')
                .replace('\u202F', ' ')
                .replace('’', '\'')
                .replace('‘', '\'')
                .replace('“', '"')
                .replace('”', '"')
                .replace('–', '-')
                .replace('—', '-')
                .replace('−', '-')
                .replace("œ", "oe")
                .replace("Œ", "OE")
                .trim();
        return clean
                .replaceAll("[\\p{Cntrl}&&[^\\r\\n\\t]]", " ")
                .replaceAll("[^\\u0020-\\u00FF]", " ")
                .trim();
    }
}
