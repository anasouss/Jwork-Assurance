package com.assurance.service;

import com.assurance.dto.request.DevisPdfFilterRequest;
import com.assurance.entity.AssistanceContrat;
import com.assurance.entity.Client;
import com.assurance.entity.Contrat;
import com.assurance.entity.ContratClient;
import com.assurance.entity.ContratGarantie;
import com.assurance.entity.Usage;
import com.assurance.entity.Vehicule;
import com.assurance.enums.RoleClientContrat;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.ContratRepository;
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
import java.util.Collection;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DevisPdfService {

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

    @Transactional(readOnly = true)
    public byte[] generate(Long agenceId, Long contratId, DevisPdfFilterRequest filter) {
        Contrat contrat = contratRepository.findByAgenceIdAndId(agenceId, contratId)
                .orElseThrow(() -> new ResourceNotFoundException("Contrat", contratId));
        if (!Boolean.TRUE.equals(contrat.getProspection())) {
            throw new BadRequestException("Le document devis est disponible uniquement pour une prospection");
        }

        try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            PdfWriter writer = new PdfWriter(output);
            PdfDocument pdf = new PdfDocument(writer);
            Document document = new Document(pdf, PageSize.A4.rotate());
            document.setMargins(18, 16, 18, 16);
            document.setFont(PdfFontFactory.createFont(StandardFonts.HELVETICA));

            List<Vehicule> vehicules = filterVehicules(contrat, filter);
            List<AssistanceContrat> assistances = activeAssistancesFor(contrat, vehicules);
            Map<Long, List<ContratGarantie>> garantiesByVehicule = garantiesByVehicule(contrat, vehicules);
            Map<Long, BigDecimal> assistanceAmountByVehicule = assistanceAmountByVehicule(assistances);
            Map<Long, Set<String>> assistanceProductsByVehicule = assistanceProductsByVehicule(assistances);
            List<String> garantieCodes = garantieCodes(contrat, vehicules, assistances);
            boolean hasDcCapitalColumn = garantieCodes.contains("DC");
            Map<String, String> garantieLabels = garantieLabels(contrat);
            Map<String, Integer> garantieOrder = garantieOrder(garantieCodes);

            writeHeader(document);
            writeContext(document, contrat);
            writeTarif(document, vehicules, garantiesByVehicule, assistanceAmountByVehicule,
                    assistanceProductsByVehicule, garantieCodes, hasDcCapitalColumn);
            writeLegend(document, garantieCodes, garantieOrder, garantieLabels);

            int sectionIndex = 2;
            if (writeFranchises(document, vehicules, garantiesByVehicule, garantieCodes, sectionIndex)) {
                sectionIndex++;
            }
            writeAssistances(document, assistances, sectionIndex);

            document.close();
            return output.toByteArray();
        } catch (Exception ex) {
            throw new BadRequestException("Generation du devis impossible");
        }
    }

    private void writeHeader(Document document) throws Exception {
        PdfFont bold = PdfFontFactory.createFont(StandardFonts.HELVETICA_BOLD);
        Table titleTable = new Table(new float[]{1})
                .setWidth(UnitValue.createPercentValue(62))
                .setHorizontalAlignment(HorizontalAlignment.CENTER);
        titleTable.addCell(new Cell()
                .add(new Paragraph("PROPOSITION D'ASSURANCE\nFLOTTE AUTOMOBILE")
                        .setFont(bold)
                        .setFontSize(13)
                        .setTextAlignment(TextAlignment.CENTER)
                        .setFontColor(ACCENT))
                .setBackgroundColor(TITLE_BG)
                .setBorder(new SolidBorder(ACCENT, 1.3f))
                .setPaddingTop(6)
                .setPaddingBottom(6));
        document.add(titleTable);
        document.add(new Paragraph(" ").setMarginBottom(6));
    }

    private void writeContext(Document document, Contrat contrat) {
        String insured = resolveAssure(contrat);
        String clientAddress = resolveAddress(contrat);
        String devisNumber = value(contrat.getNumeroDevis(), value(contrat.getNumeroPolice(), "DEV-" + contrat.getId()));
        String agencyCity = contrat.getAgence() == null ? "" : value(contrat.getAgence().getVille(), "");
        String cityAndDate = (agencyCity.isBlank() ? "" : agencyCity + " le ") + formatDateTime(contrat.getCreatedAt());

        Table infoHeader = new Table(new float[]{6, 4}).setWidth(UnitValue.createPercentValue(100));
        infoHeader.addCell(new Cell()
                .add(new Paragraph().add(new Text("Assuré : ").setBold().setFontColor(ACCENT)).add(safe(insured)).setFontSize(10))
                .add(new Paragraph().add(new Text("Adresse : ").setBold().setFontColor(ACCENT)).add(safe(clientAddress)).setFontSize(10))
                .setBorder(new SolidBorder(SOFT_BORDER, 0.9f))
                .setPadding(6));
        infoHeader.addCell(new Cell()
                .add(new Paragraph("Devis N° " + safe(devisNumber)).setBold().setFontSize(10).setFontColor(ACCENT))
                .add(new Paragraph(safe(cityAndDate)).setFontSize(10))
                .setTextAlignment(TextAlignment.RIGHT)
                .setBorder(new SolidBorder(SOFT_BORDER, 0.9f))
                .setPadding(6));
        document.add(infoHeader);
        document.add(new Paragraph(" ").setMarginBottom(3));

        Table introBox = new Table(new float[]{1}).setWidth(UnitValue.createPercentValue(100));
        introBox.addCell(new Cell()
                .add(new Paragraph("Messieurs,").setBold().setFontSize(10))
                .add(new Paragraph("Nous avons l'honneur de vous communiquer ci-dessous notre proposition d'assurance automobile, correspondante à votre parc automobile, et ce pour la période :")
                        .setBold().setFontSize(10))
                .add(new Paragraph("Du " + formatDate(contrat.getDateEffet()) + "  Au " + formatDate(contrat.getDateEcheance()))
                        .setBold().setFontSize(10).setFontColor(ACCENT))
                .setBackgroundColor(SOFT_BG)
                .setBorder(new SolidBorder(SOFT_BORDER, 0.9f))
                .setPadding(6));
        document.add(introBox);
        document.add(new Paragraph(" ").setMarginBottom(3));
        document.add(new Paragraph("I. Le tarif").setBold().setFontSize(11));
        document.add(new Paragraph(" ").setMarginBottom(2));
    }

    private void writeTarif(
            Document document,
            List<Vehicule> vehicules,
            Map<Long, List<ContratGarantie>> garantiesByVehicule,
            Map<Long, BigDecimal> assistanceAmountByVehicule,
            Map<Long, Set<String>> assistanceProductsByVehicule,
            List<String> garantieCodes,
            boolean hasDcCapitalColumn
    ) {
        List<String> codes = garantieCodes.isEmpty() ? List.of("-") : garantieCodes;
        int valuesColumnsCount = hasDcCapitalColumn ? 4 : 3;
        int guaranteeColumnsCount = Math.max(1, codes.size());
        int totalColumns = 7 + valuesColumnsCount + guaranteeColumnsCount;
        float[] widths = new float[totalColumns];
        for (int i = 0; i < totalColumns; i++) {
            widths[i] = 1.0f;
        }
        widths[0] = 1.2f;
        widths[1] = 1.3f;
        widths[2] = 1.5f;
        widths[3] = 1.2f;
        widths[4] = 1.0f;
        widths[5] = 1.0f;
        widths[totalColumns - 1] = 1.4f;

        Table table = new Table(widths).setWidth(UnitValue.createPercentValue(100));
        table.addCell(headerCell("Usage", 2, 1));
        table.addCell(headerCell("Marque", 2, 1));
        table.addCell(headerCell("N°\nd'immatric", 2, 1));
        table.addCell(headerCell("Date de\nMC", 2, 1));
        table.addCell(headerCell("PF/PTC", 2, 1));
        table.addCell(headerCell("ENERGIE", 2, 1));
        table.addCell(headerCell("VALEURS", 1, valuesColumnsCount));
        table.addCell(headerCell("GARANTIES A ASSURER", 1, guaranteeColumnsCount).setBackgroundColor(GUARANTEE_GROUP_BG));
        table.addCell(headerCell("Montant total", 2, 1));

        table.addCell(headerCell("Valeur à\nNeuf", 1, 1));
        table.addCell(headerCell("Valeur\nVénale", 1, 1));
        table.addCell(headerCell("Valeur des\nglaces", 1, 1));
        if (hasDcCapitalColumn) {
            table.addCell(headerCell("Capital\nDC", 1, 1));
        }
        for (String code : codes) {
            table.addCell(guaranteeCodeHeaderCell(code));
        }

        BigDecimal grandTotal = BigDecimal.ZERO;
        for (int rowIndex = 0; rowIndex < vehicules.size(); rowIndex++) {
            Vehicule vehicule = vehicules.get(rowIndex);
            DeviceRgb rowBackground = rowIndex % 2 == 0 ? null : TABLE_ROW_ALT_BG;
            List<ContratGarantie> garanties = garantiesByVehicule.getOrDefault(vehicule.getId(), List.of());
            Map<String, List<ContratGarantie>> byCode = garanties.stream()
                    .filter(this::isSelectedGarantie)
                    .collect(Collectors.groupingBy(g -> g.getGarantie().getCode().toUpperCase(Locale.ROOT)));
            BigDecimal vehicleTotal = totalGaranties(garanties).add(assistanceAmountByVehicule.getOrDefault(vehicule.getId(), BigDecimal.ZERO));
            grandTotal = grandTotal.add(vehicleTotal);

            table.addCell(valueCell(usageLabel(vehicule), TextAlignment.LEFT, rowBackground));
            table.addCell(valueCell(vehicule.getMarque() != null ? value(vehicule.getMarque().getLibelle(), "") : "", TextAlignment.LEFT, rowBackground));
            table.addCell(valueCell(value(vehicule.getImmatriculation(), ""), TextAlignment.CENTER, rowBackground));
            table.addCell(valueCell(formatDate(vehicule.getDatePremiereCirculation()), TextAlignment.CENTER, rowBackground));
            table.addCell(valueCell(pfOrPtc(vehicule), TextAlignment.CENTER, rowBackground));
            table.addCell(valueCell(value(vehicule.getCarburant(), "").toUpperCase(Locale.ROOT), TextAlignment.CENTER, rowBackground));
            table.addCell(valueCell(formatMoneyOrEmpty(vehicule.getValeurNeuf()), TextAlignment.RIGHT, rowBackground));
            table.addCell(valueCell(formatMoneyOrEmpty(vehicule.getValeurVenale()), TextAlignment.RIGHT, rowBackground));
            table.addCell(valueCell(formatMoneyOrEmpty(vehicule.getValeurGlace()), TextAlignment.RIGHT, rowBackground));
            if (hasDcCapitalColumn) {
                table.addCell(valueCell(formatMoneyOrEmpty(capitalFor(byCode.get("DC"))), TextAlignment.RIGHT, rowBackground));
            }

            for (String code : codes) {
                if ("-".equals(code)) {
                    table.addCell(valueCell("-", TextAlignment.CENTER, rowBackground));
                    continue;
                }
                if ("ASSISTANCE".equals(code)) {
                    Set<String> productNames = assistanceProductsByVehicule.get(vehicule.getId());
                    String text = productNames == null || productNames.isEmpty() ? "" : String.join(" / ", productNames);
                    table.addCell(valueCell(text, TextAlignment.CENTER, text.isBlank() ? rowBackground : ASSISTANCE_VALUE_BG));
                    continue;
                }
                List<ContratGarantie> guaranteeDetails = byCode.get(code);
                boolean selected = guaranteeDetails != null && !guaranteeDetails.isEmpty();
                table.addCell(guaranteeStateCell(selected ? markerFor(code, guaranteeDetails) : "", rowBackground));
            }
            table.addCell(valueCell(formatMoney(vehicleTotal), TextAlignment.RIGHT, rowBackground).setBold());
        }

        table.addCell(new Cell(1, totalColumns - 1)
                .add(new Paragraph("TOTAL").setBold())
                .setTextAlignment(TextAlignment.CENTER)
                .setBorder(new SolidBorder(TABLE_BORDER, 1.2f)));
        table.addCell(valueCell(formatMoney(grandTotal), TextAlignment.RIGHT, null).setBold());
        document.add(table);
        document.add(new Paragraph(" "));
    }

    private void writeLegend(Document document, List<String> garantieCodes, Map<String, Integer> order, Map<String, String> labels) {
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
            if ("ASSISTANCE".equals(code)) {
                continue;
            }
            Integer index = order.get(code);
            if (index == null) {
                continue;
            }
            if (count > 0) {
                legend.add("   |   ");
            }
            legend.add(new Text(code));
            legend.add(new Text(String.valueOf(index)).setTextRise(2.8f).setFontSize(5.8f));
            legend.add(new Text(": " + value(labels.get(code), code)));
            count++;
        }
        if (count > 0) {
            document.add(legend);
        }
    }

    private boolean writeFranchises(
            Document document,
            List<Vehicule> vehicules,
            Map<Long, List<ContratGarantie>> garantiesByVehicule,
            List<String> garantieCodes,
            int sectionIndex
    ) {
        List<Usage> usages = vehicules.stream()
                .map(Vehicule::getUsage)
                .filter(usage -> usage != null)
                .collect(Collectors.collectingAndThen(
                        Collectors.toMap(Usage::getId, usage -> usage, (a, b) -> a, LinkedHashMap::new),
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

        document.add(new Paragraph(toRoman(sectionIndex) + ". Les franchises").setBold().setFontSize(11));
        Table table = new Table(new float[]{1.5f, 5.5f}).setWidth(UnitValue.createPercentValue(52));
        table.addCell(headerCell("Garanties", 1, 1));
        table.addCell(headerCell("Franchises par usage", 1, 1));

        for (int rowIndex = 0; rowIndex < codesWithFranchise.size(); rowIndex++) {
            String code = codesWithFranchise.get(rowIndex);
            DeviceRgb rowBackground = rowIndex % 2 == 0 ? null : TABLE_ROW_ALT_BG;
            table.addCell(valueCell(code, TextAlignment.CENTER, rowBackground).setBold());
            Contrat contrat = vehicules.isEmpty() ? null : vehicules.get(0).getContrat();
            String text = usages.stream()
                    .map(usage -> usageLabel(contrat, usage) + ": " + franchiseFor(usage, code, vehicules, garantiesByVehicule))
                    .filter(value -> !value.endsWith(": "))
                    .collect(Collectors.joining(" / "));
            table.addCell(valueCell(text, TextAlignment.CENTER, rowBackground));
        }
        document.add(table);
        document.add(new Paragraph(" "));
        return true;
    }

    private void writeAssistances(Document document, List<AssistanceContrat> assistances, int sectionIndex) {
        Map<String, String> productsAndPrestations = new LinkedHashMap<>();
        for (AssistanceContrat assistance : assistances) {
            String product = assistanceProductName(assistance);
            if (product.isBlank()) {
                continue;
            }
            String prestations = assistance.getProduitAssistance() == null ? "" : safe(assistance.getProduitAssistance().getPrestations());
            productsAndPrestations.putIfAbsent(product, prestations.isBlank() ? "-" : prestations);
        }
        if (productsAndPrestations.isEmpty()) {
            return;
        }

        document.add(new Paragraph(toRoman(sectionIndex) + ". Les prestations d'assistance").setBold().setFontSize(11).setKeepWithNext(true));
        Table table = new Table(new float[]{2, 6}).setWidth(UnitValue.createPercentValue(100)).setKeepTogether(true);
        table.addCell(headerCell("Produit", 1, 1));
        table.addCell(headerCell("Prestations", 1, 1));
        int rowIndex = 0;
        for (Map.Entry<String, String> entry : productsAndPrestations.entrySet()) {
            DeviceRgb rowBackground = rowIndex % 2 == 0 ? null : TABLE_ROW_ALT_BG;
            table.addCell(valueCell(entry.getKey(), TextAlignment.LEFT, rowBackground).setKeepTogether(true));
            table.addCell(valueCell(entry.getValue(), TextAlignment.LEFT, rowBackground).setKeepTogether(true));
            rowIndex++;
        }
        document.add(table);
    }

    private List<Vehicule> filterVehicules(Contrat contrat, DevisPdfFilterRequest filter) {
        List<Vehicule> vehicules = sortedVehicules(contrat.getVehicules() == null ? List.of() : contrat.getVehicules());
        if (filter == null) {
            return vehicules;
        }
        Set<Long> vehiculeIds = filter.getVehiculeIds() == null ? Set.of() : new HashSet<>(filter.getVehiculeIds());
        Set<Long> usageIds = filter.getUsageIds() == null ? Set.of() : new HashSet<>(filter.getUsageIds());
        if (vehiculeIds.isEmpty() && usageIds.isEmpty()) {
            return vehicules;
        }
        return vehicules.stream()
                .filter(vehicule -> vehiculeIds.contains(vehicule.getId())
                        || (vehicule.getUsage() != null && usageIds.contains(vehicule.getUsage().getId())))
                .toList();
    }

    private List<Vehicule> sortedVehicules(Collection<Vehicule> vehicules) {
        return vehicules.stream()
                .sorted(Comparator.comparing((Vehicule v) -> usageLabel(v), String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(v -> value(v.getImmatriculation(), ""), String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(Vehicule::getId, Comparator.nullsLast(Long::compareTo)))
                .toList();
    }

    private Map<Long, List<ContratGarantie>> garantiesByVehicule(Contrat contrat, List<Vehicule> vehicules) {
        Set<Long> vehiculeIds = vehicules.stream().map(Vehicule::getId).collect(Collectors.toSet());
        Map<Long, List<ContratGarantie>> map = new LinkedHashMap<>();
        for (ContratGarantie garantie : contrat.getGaranties() == null ? List.<ContratGarantie>of() : contrat.getGaranties()) {
            if (garantie.getVehicule() == null || !vehiculeIds.contains(garantie.getVehicule().getId())) {
                continue;
            }
            map.computeIfAbsent(garantie.getVehicule().getId(), ignored -> new ArrayList<>()).add(garantie);
        }
        return map;
    }

    private List<String> garantieCodes(Contrat contrat, List<Vehicule> vehicules, List<AssistanceContrat> assistances) {
        Set<Long> vehiculeIds = vehicules.stream().map(Vehicule::getId).collect(Collectors.toSet());
        Set<String> codes = new LinkedHashSet<>();
        for (ContratGarantie garantie : contrat.getGaranties() == null ? List.<ContratGarantie>of() : contrat.getGaranties()) {
            if (garantie.getGarantie() == null || garantie.getGarantie().getCode() == null) {
                continue;
            }
            if (garantie.getVehicule() != null && !vehiculeIds.contains(garantie.getVehicule().getId())) {
                continue;
            }
            if (isSelectedGarantie(garantie)) {
                codes.add(garantie.getGarantie().getCode().toUpperCase(Locale.ROOT));
            }
        }
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

    private Map<String, String> garantieLabels(Contrat contrat) {
        Map<String, String> labels = new LinkedHashMap<>();
        for (ContratGarantie garantie : contrat.getGaranties() == null ? List.<ContratGarantie>of() : contrat.getGaranties()) {
            if (garantie.getGarantie() != null && garantie.getGarantie().getCode() != null) {
                labels.putIfAbsent(garantie.getGarantie().getCode().toUpperCase(Locale.ROOT), safe(garantie.getGarantie().getLibelle()));
            }
        }
        labels.putIfAbsent("ASSISTANCE", "Assistance");
        return labels;
    }

    private Map<String, Integer> garantieOrder(List<String> garantieCodes) {
        Map<String, Integer> order = new LinkedHashMap<>();
        int index = 1;
        for (String code : garantieCodes) {
            if (!"ASSISTANCE".equals(code)) {
                order.put(code, index++);
            }
        }
        return order;
    }

    private List<AssistanceContrat> activeAssistancesFor(Contrat contrat, List<Vehicule> vehicules) {
        Set<Long> vehiculeIds = vehicules.stream().map(Vehicule::getId).collect(Collectors.toSet());
        return (contrat.getAssistances() == null ? List.<AssistanceContrat>of() : contrat.getAssistances()).stream()
                .filter(assistance -> Boolean.TRUE.equals(assistance.getActif()))
                .filter(assistance -> assistance.getVehicule() != null && vehiculeIds.contains(assistance.getVehicule().getId()))
                .toList();
    }

    private Map<Long, BigDecimal> assistanceAmountByVehicule(List<AssistanceContrat> assistances) {
        Map<Long, BigDecimal> amounts = new LinkedHashMap<>();
        for (AssistanceContrat assistance : assistances) {
            if (assistance.getVehicule() == null) {
                continue;
            }
            amounts.merge(assistance.getVehicule().getId(), nullToZero(assistance.getPrimeTotale()), BigDecimal::add);
        }
        return amounts;
    }

    private Map<Long, Set<String>> assistanceProductsByVehicule(List<AssistanceContrat> assistances) {
        Map<Long, Set<String>> products = new LinkedHashMap<>();
        for (AssistanceContrat assistance : assistances) {
            if (assistance.getVehicule() == null) {
                continue;
            }
            String product = assistanceProductName(assistance);
            if (!product.isBlank()) {
                products.computeIfAbsent(assistance.getVehicule().getId(), ignored -> new LinkedHashSet<>()).add(product);
            }
        }
        return products;
    }

    private boolean isSelectedGarantie(ContratGarantie garantie) {
        if (garantie.getGarantie() == null || garantie.getGarantie().getCode() == null) {
            return false;
        }
        if ("RC".equalsIgnoreCase(garantie.getGarantie().getCode())) {
            return true;
        }
        return nullToZero(garantie.getPrime()).compareTo(BigDecimal.ZERO) != 0
                || nullToZero(garantie.getCapital()).compareTo(BigDecimal.ZERO) != 0
                || nullToZero(garantie.getTaux()).compareTo(BigDecimal.ZERO) != 0
                || nullToZero(garantie.getTauxFranchise()).compareTo(BigDecimal.ZERO) != 0
                || nullToZero(garantie.getFranchiseMinimale()).compareTo(BigDecimal.ZERO) != 0;
    }

    private boolean hasFranchise(Usage usage, String code, List<Vehicule> vehicules, Map<Long, List<ContratGarantie>> garantiesByVehicule) {
        return vehicules.stream()
                .filter(vehicule -> sameUsage(usage, vehicule.getUsage()))
                .flatMap(vehicule -> garantiesByVehicule.getOrDefault(vehicule.getId(), List.of()).stream())
                .filter(garantie -> garantie.getGarantie() != null && code.equalsIgnoreCase(garantie.getGarantie().getCode()))
                .anyMatch(garantie -> nullToZero(garantie.getTauxFranchise()).compareTo(BigDecimal.ZERO) > 0
                        || nullToZero(garantie.getFranchiseMinimale()).compareTo(BigDecimal.ZERO) > 0);
    }

    private String franchiseFor(Usage usage, String code, List<Vehicule> vehicules, Map<Long, List<ContratGarantie>> garantiesByVehicule) {
        return vehicules.stream()
                .filter(vehicule -> sameUsage(usage, vehicule.getUsage()))
                .flatMap(vehicule -> garantiesByVehicule.getOrDefault(vehicule.getId(), List.of()).stream())
                .filter(garantie -> garantie.getGarantie() != null && code.equalsIgnoreCase(garantie.getGarantie().getCode()))
                .map(this::franchiseText)
                .filter(value -> !value.isBlank())
                .distinct()
                .collect(Collectors.joining("\n"));
    }

    private String franchiseText(ContratGarantie garantie) {
        BigDecimal taux = nullToZero(garantie.getTauxFranchise());
        BigDecimal min = nullToZero(garantie.getFranchiseMinimale());
        if (taux.compareTo(BigDecimal.ZERO) == 0 && min.compareTo(BigDecimal.ZERO) == 0) {
            return "";
        }
        if (taux.compareTo(BigDecimal.ZERO) > 0 && min.compareTo(BigDecimal.ZERO) == 0) {
            return formatPercent(taux);
        }
        if (taux.compareTo(BigDecimal.ZERO) == 0) {
            return formatMoney(min) + " DH";
        }
        return formatPercent(taux) + " avec minimum " + formatMoney(min) + " DH";
    }

    private String markerFor(String code, List<ContratGarantie> garanties) {
        if ("DV".equals(code)) {
            return garanties.stream()
                    .map(ContratGarantie::getTauxFranchise)
                    .filter(value -> value != null && value.compareTo(BigDecimal.ZERO) > 0)
                    .findFirst()
                    .map(value -> "FR" + formatPercent(value))
                    .orElse("X");
        }
        return "X";
    }

    private BigDecimal totalGaranties(List<ContratGarantie> garanties) {
        return garanties.stream()
                .filter(this::isSelectedGarantie)
                .map(ContratGarantie::getPrime)
                .map(this::nullToZero)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal capitalFor(List<ContratGarantie> garanties) {
        if (garanties == null || garanties.isEmpty()) {
            return BigDecimal.ZERO;
        }
        return garanties.stream()
                .map(ContratGarantie::getCapital)
                .filter(value -> value != null && value.compareTo(BigDecimal.ZERO) > 0)
                .findFirst()
                .orElse(nullToZero(garanties.get(0).getCapital()));
    }

    private String resolveAssure(Contrat contrat) {
        Client client = resolveClient(contrat);
        return client == null ? "-" : clientLabel(client);
    }

    private String resolveAddress(Contrat contrat) {
        Client client = resolveClient(contrat);
        if (client == null) {
            return "-";
        }
        String address = value(client.getAdresse(), "");
        String city = client.getVille() == null ? "" : value(client.getVille().getNom(), "");
        if (!address.isBlank() && !city.isBlank()) {
            return address + ", " + city;
        }
        return !address.isBlank() ? address : value(city, "-");
    }

    private Client resolveClient(Contrat contrat) {
        return contrat.getClients() == null ? null : contrat.getClients().stream()
                .filter(link -> link.getRole() == RoleClientContrat.SOUSCRIPTEUR)
                .map(ContratClient::getClient)
                .findFirst()
                .orElse(null);
    }

    private String clientLabel(Client client) {
        if (client.getRaisonSociale() != null && !client.getRaisonSociale().isBlank()) {
            return client.getRaisonSociale();
        }
        String fullName = (value(client.getNom(), "") + " " + value(client.getPrenom(), "")).trim();
        if (!fullName.isBlank()) {
            return fullName;
        }
        return value(client.getRc(), value(client.getCin(), ""));
    }

    private String usageLabel(Vehicule vehicule) {
        return vehicule == null ? "" : usageLabel(vehicule.getContrat(), vehicule.getUsage());
    }

    private String usageLabel(Contrat contrat, Usage usage) {
        if (usage == null) {
            return "";
        }
        String code = value(usage.getCode(), "");
        if (!code.isBlank() && isLocationCategory(contrat)) {
            return "LOCATION - " + code;
        }
        return value(code, usage.getLibelle());
    }

    private boolean isLocationCategory(Contrat contrat) {
        Client client = contrat == null ? null : resolveClient(contrat);
        if (client == null || client.getCategorieClient() == null) {
            return false;
        }
        return "LOCATION".equalsIgnoreCase(value(client.getCategorieClient().getCode(), ""));
    }

    private String pfOrPtc(Vehicule vehicule) {
        if (vehicule == null) {
            return "";
        }
        if (vehicule.getUsage() != null && Boolean.TRUE.equals(vehicule.getUsage().getByPtc())) {
            return value(vehicule.getPtc(), "");
        }
        if (vehicule.getUsage() != null && Boolean.TRUE.equals(vehicule.getUsage().getBySousClasse())) {
            return value(vehicule.getSousClasse(), "");
        }
        if (vehicule.getPtc() != null && !vehicule.getPtc().isBlank()) {
            return vehicule.getPtc();
        }
        if (vehicule.getSousClasse() != null && !vehicule.getSousClasse().isBlank()) {
            return vehicule.getSousClasse();
        }
        return value(vehicule.getPuissanceFiscale(), "");
    }

    private String assistanceProductName(AssistanceContrat assistance) {
        if (assistance == null) {
            return "";
        }
        if (assistance.getProduit() != null && !assistance.getProduit().isBlank()) {
            return assistance.getProduit();
        }
        return assistance.getProduitAssistance() == null ? "" : value(assistance.getProduitAssistance().getLibelle(), "");
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
        cell.setBackgroundColor("ASSISTANCE".equalsIgnoreCase(code) ? ASSISTANCE_BG : GUARANTEE_HEADER_BG);
        return cell;
    }

    private Cell guaranteeStateCell(String text, DeviceRgb rowBackground) {
        boolean selected = text != null && !text.isBlank();
        Cell cell = valueCell(text == null ? "" : text, TextAlignment.CENTER, rowBackground);
        if (selected) {
            cell.setBold();
            cell.setBackgroundColor(SELECTED_BG);
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
        DecimalFormat format = decimalFormat();
        return format.format(value == null ? BigDecimal.ZERO : value);
    }

    private static String formatPercent(BigDecimal value) {
        return formatMoney(value) + "%";
    }

    private static DecimalFormat decimalFormat() {
        DecimalFormatSymbols symbols = new DecimalFormatSymbols(Locale.FRANCE);
        symbols.setGroupingSeparator(' ');
        symbols.setDecimalSeparator(',');
        return new DecimalFormat("#,##0.##", symbols);
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
                .replaceAll("[\\p{Cntrl}&&[^\r\n\t]]", " ")
                .replaceAll("[^\\u0020-\\u00FF]", " ")
                .trim();
    }
}
