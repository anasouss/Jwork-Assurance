package com.assurance.service;

import com.assurance.dto.request.DevisPdfFilterRequest;
import com.assurance.entity.AssistanceContrat;
import com.assurance.entity.Client;
import com.assurance.entity.Contrat;
import com.assurance.entity.ContratClient;
import com.assurance.entity.ContratGarantie;
import com.assurance.entity.Vehicule;
import com.assurance.enums.RoleClientContrat;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.ContratRepository;
import lombok.RequiredArgsConstructor;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
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

    private static final Color ACCENT = new Color(28, 55, 92);
    private static final Color SOFT_BORDER = new Color(215, 224, 236);
    private static final Color TABLE_BORDER = new Color(68, 68, 68);
    private static final Color HEADER_BG = new Color(243, 246, 251);
    private static final Color ALT_ROW_BG = new Color(249, 251, 254);
    private static final Color SELECTED_BG = new Color(232, 245, 233);
    private static final Color ASSISTANCE_BG = new Color(255, 248, 220);

    private final ContratRepository contratRepository;

    @Transactional(readOnly = true)
    public byte[] generate(Long agenceId, Long contratId, DevisPdfFilterRequest filter) {
        Contrat contrat = contratRepository.findByAgenceIdAndId(agenceId, contratId)
                .orElseThrow(() -> new ResourceNotFoundException("Contrat", contratId));
        if (!Boolean.TRUE.equals(contrat.getProspection())) {
            throw new BadRequestException("Le document devis est disponible uniquement pour une prospection");
        }

        List<Vehicule> vehicules = filterVehicules(contrat, filter);
        List<AssistanceContrat> assistances = activeAssistancesFor(contrat, vehicules);
        List<String> garantieCodes = garantieCodes(contrat, vehicules, assistances);
        Map<String, String> garantieLabels = garantieLabels(contrat);

        try (PDDocument document = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            Writer writer = new Writer(document);
            writeHeader(writer);
            writeContext(writer, contrat);
            writeTarif(writer, contrat, vehicules, assistances, garantieCodes);
            writeLegend(writer, garantieCodes, garantieLabels);
            writeFranchises(writer, contrat, vehicules, garantieCodes);
            writeAssistances(writer, assistances);
            writer.close();
            document.save(output);
            return output.toByteArray();
        } catch (IOException | IllegalArgumentException ex) {
            throw new BadRequestException("Generation du devis impossible");
        }
    }

    private void writeHeader(Writer writer) throws IOException {
        float width = 500;
        float x = (writer.pageWidth() - width) / 2;
        writer.rect(x, writer.y() - 52, width, 52, new Color(245, 248, 252), ACCENT);
        writer.center("PROPOSITION D'ASSURANCE", x, writer.y() - 19, width, PDType1Font.HELVETICA_BOLD, 13, ACCENT);
        writer.center("FLOTTE AUTOMOBILE", x, writer.y() - 39, width, PDType1Font.HELVETICA_BOLD, 13, ACCENT);
        writer.moveDown(70);
    }

    private void writeContext(Writer writer, Contrat contrat) throws IOException {
        float y = writer.y();
        float leftW = (writer.pageWidth() - writer.margin() * 2) * 0.69f;
        float rightW = writer.pageWidth() - writer.margin() * 2 - leftW;
        writer.rect(writer.margin(), y - 50, leftW, 50, null, SOFT_BORDER);
        writer.text("Assuré : " + resolveAssure(contrat), writer.margin() + 8, y - 17, PDType1Font.HELVETICA_BOLD, 10, ACCENT, leftW - 16);
        writer.text("Adresse : " + resolveAddress(contrat), writer.margin() + 8, y - 33, PDType1Font.HELVETICA_BOLD, 10, ACCENT, leftW - 16);
        writer.rect(writer.margin() + leftW, y - 50, rightW, 50, null, SOFT_BORDER);
        writer.right("Devis N° " + value(contrat.getNumeroDevis(), value(contrat.getNumeroPolice(), "DEV-" + contrat.getId())),
                writer.margin() + leftW + 8, y - 17, rightW - 16, PDType1Font.HELVETICA_BOLD, 10, ACCENT);
        writer.right(value(contrat.getAgence() == null ? null : contrat.getAgence().getVille(), "Agadir") + " le " + formatDateTime(contrat.getCreatedAt()),
                writer.margin() + leftW + 8, y - 33, rightW - 16, PDType1Font.HELVETICA_BOLD, 10, Color.BLACK);
        writer.moveDown(62);

        y = writer.y();
        writer.rect(writer.margin(), y - 58, writer.pageWidth() - writer.margin() * 2, 58, new Color(248, 250, 253), SOFT_BORDER);
        writer.text("Messieurs,", writer.margin() + 8, y - 14, PDType1Font.HELVETICA_BOLD, 10, Color.BLACK, 740);
        writer.text("Nous avons l'honneur de vous communiquer ci-dessous notre proposition d'assurance automobile, correspondante à votre parc automobile, et ce pour la période :",
                writer.margin() + 8, y - 30, PDType1Font.HELVETICA_BOLD, 10, Color.BLACK, 740);
        writer.text("Du " + formatDate(contrat.getDateEffet()) + "  Au " + formatDate(contrat.getDateEcheance()),
                writer.margin() + 8, y - 47, PDType1Font.HELVETICA_BOLD, 10, ACCENT, 740);
        writer.moveDown(74);
        writer.section("I. Le tarif");
    }

    private void writeTarif(
            Writer writer,
            Contrat contrat,
            List<Vehicule> vehicules,
            List<AssistanceContrat> assistances,
            List<String> garantieCodes
    ) throws IOException {
        List<String> codes = garantieCodes.isEmpty() ? List.of("-") : garantieCodes;
        int fixedColumns = 10;
        int totalColumns = fixedColumns + codes.size();
        float tableWidth = writer.pageWidth() - writer.margin() * 2;
        float[] weights = new float[totalColumns];
        for (int i = 0; i < totalColumns; i++) {
            weights[i] = 1.0f;
        }
        weights[0] = 1.2f;
        weights[1] = 1.3f;
        weights[2] = 1.5f;
        weights[3] = 1.2f;
        weights[4] = 1.0f;
        weights[5] = 1.0f;
        weights[totalColumns - 1] = 1.4f;
        float unit = tableWidth / sum(weights, 0, totalColumns);
        float[] widths = new float[totalColumns];
        for (int i = 0; i < totalColumns; i++) {
            widths[i] = weights[i] * unit;
        }

        writer.ensureRows(2 + vehicules.size() + 2, 18);
        float x = writer.margin();
        float y = writer.y();
        writer.cell(x, y, widths[0], 48, "Usage", true, HEADER_BG);
        writer.cell(x += widths[0], y, widths[1], 48, "Marque", true, HEADER_BG);
        writer.cell(x += widths[1], y, widths[2], 48, "N°\nd'immatric", true, HEADER_BG);
        writer.cell(x += widths[2], y, widths[3], 48, "Date de\nMC", true, HEADER_BG);
        writer.cell(x += widths[3], y, widths[4], 48, "PF/PTC", true, HEADER_BG);
        writer.cell(x += widths[4], y, widths[5], 48, "ENERGIE", true, HEADER_BG);
        writer.cell(x += widths[5], y, widths[6] + widths[7] + widths[8], 18, "VALEURS", true, HEADER_BG);
        float garantieGroupX = x + widths[6] + widths[7] + widths[8];
        writer.cell(garantieGroupX, y, sum(widths, 9, totalColumns - 1), 18, "GARANTIES A ASSURER", true, new Color(236, 242, 250));
        writer.cell(writer.margin() + sum(widths, 0, totalColumns - 1), y, widths[totalColumns - 1], 48, "Montant total", true, HEADER_BG);
        y -= 24;
        x += widths[5];
        writer.cell(x, y, widths[6], 24, "Valeur à\nNeuf", true, HEADER_BG);
        writer.cell(x += widths[6], y, widths[7], 24, "Valeur\nVénale", true, HEADER_BG);
        writer.cell(x += widths[7], y, widths[8], 24, "Valeur des\nglaces", true, HEADER_BG);
        x += widths[8];
        for (int i = 0; i < codes.size(); i++) {
            String code = codes.get(i);
            writer.cell(x, y, widths[9 + i], 24, code, true, "ASSISTANCE".equals(code) ? ASSISTANCE_BG : new Color(242, 246, 252));
            x += widths[9 + i];
        }
        writer.moveDown(48);

        BigDecimal grandTotal = BigDecimal.ZERO;
        int rowIndex = 0;
        for (Vehicule vehicule : vehicules) {
            Color bg = rowIndex % 2 == 0 ? null : ALT_ROW_BG;
            BigDecimal vehicleTotal = totalVehicule(contrat, vehicule).add(totalAssistance(assistances, vehicule));
            grandTotal = grandTotal.add(vehicleTotal);
            Map<String, List<ContratGarantie>> garanties = garantiesByCode(contrat, vehicule);
            x = writer.margin();
            y = writer.y();
            writer.cell(x, y, widths[0], 20, usageLabel(vehicule), false, bg);
            writer.cell(x += widths[0], y, widths[1], 20, vehicule.getMarque() != null ? value(vehicule.getMarque().getLibelle(), "") : "", false, bg);
            writer.cell(x += widths[1], y, widths[2], 20, value(vehicule.getImmatriculation(), ""), false, bg);
            writer.cell(x += widths[2], y, widths[3], 20, formatDate(vehicule.getDatePremiereCirculation()), false, bg);
            writer.cell(x += widths[3], y, widths[4], 20, pfOrPtc(vehicule), false, bg);
            writer.cell(x += widths[4], y, widths[5], 20, value(vehicule.getCarburant(), "").toUpperCase(Locale.ROOT), false, bg);
            writer.cell(x += widths[5], y, widths[6], 20, amountOrEmpty(vehicule.getValeurNeuf()), false, bg);
            writer.cell(x += widths[6], y, widths[7], 20, amountOrEmpty(vehicule.getValeurVenale()), false, bg);
            writer.cell(x += widths[7], y, widths[8], 20, amountOrEmpty(vehicule.getValeurGlace()), false, bg);
            x += widths[8];
            for (int i = 0; i < codes.size(); i++) {
                String code = codes.get(i);
                String marker = "-".equals(code) ? "-" : markerFor(code, garanties, assistances, vehicule);
                writer.cell(x, y, widths[9 + i], 20, marker, true, marker.isBlank() ? bg : ("ASSISTANCE".equals(code) ? ASSISTANCE_BG : SELECTED_BG));
                x += widths[9 + i];
            }
            writer.cellRight(writer.margin() + sum(widths, 0, totalColumns - 1), y, widths[totalColumns - 1], 20, amount(vehicleTotal), true, bg);
            writer.moveDown(20);
            rowIndex++;
        }

        writer.cell(writer.margin(), writer.y(), tableWidth - widths[totalColumns - 1], 22, "TOTAL", true, null);
        writer.cellRight(writer.margin() + tableWidth - widths[totalColumns - 1], writer.y(), widths[totalColumns - 1], 22, amount(grandTotal), true, null);
        writer.moveDown(36);
    }

    private void writeLegend(Writer writer, List<String> garantieCodes, Map<String, String> labels) throws IOException {
        List<String> items = garantieCodes.stream()
                .filter(code -> !"ASSISTANCE".equals(code))
                .map(code -> code + ": " + value(labels.get(code), code))
                .toList();
        if (items.isEmpty()) {
            return;
        }
        writer.text(String.join("   |   ", items), writer.margin(), writer.y(), PDType1Font.HELVETICA, 7, Color.BLACK, writer.pageWidth() - writer.margin() * 2);
        writer.moveDown(16);
    }

    private void writeFranchises(Writer writer, Contrat contrat, List<Vehicule> vehicules, List<String> garantieCodes) throws IOException {
        Map<String, Map<String, String>> rows = new LinkedHashMap<>();
        for (String code : garantieCodes) {
            if ("RC".equals(code) || "ASSISTANCE".equals(code)) {
                continue;
            }
            for (Vehicule vehicule : vehicules) {
                String value = franchiseFor(contrat, vehicule, code);
                if (!value.isBlank()) {
                    rows.computeIfAbsent(code, ignored -> new LinkedHashMap<>()).put(usageLabel(vehicule), value);
                }
            }
        }
        if (rows.isEmpty()) {
            return;
        }
        writer.section("II. Les franchises");
        float x = writer.margin();
        float y = writer.y();
        writer.cell(x, y, 90, 20, "Garanties", true, HEADER_BG);
        writer.cell(x + 90, y, 340, 20, "Franchises par usage", true, HEADER_BG);
        writer.moveDown(20);
        for (Map.Entry<String, Map<String, String>> entry : rows.entrySet()) {
            writer.cell(writer.margin(), writer.y(), 90, 22, entry.getKey(), true, null);
            String text = entry.getValue().entrySet().stream()
                    .map(item -> item.getKey() + ": " + item.getValue())
                    .collect(Collectors.joining(" / "));
            writer.cell(writer.margin() + 90, writer.y(), 340, 22, text, false, null);
            writer.moveDown(22);
        }
        writer.moveDown(14);
    }

    private void writeAssistances(Writer writer, List<AssistanceContrat> assistances) throws IOException {
        if (assistances.isEmpty()) {
            return;
        }
        writer.section("III. Les prestations d'assistance");
        writer.cell(writer.margin(), writer.y(), 180, 20, "Produit", true, HEADER_BG);
        writer.cell(writer.margin() + 180, writer.y(), 560, 20, "Prestations", true, HEADER_BG);
        writer.moveDown(20);
        for (AssistanceContrat assistance : assistances) {
            writer.cell(writer.margin(), writer.y(), 180, 24, value(assistance.getProduit(), "-"), false, null);
            writer.cell(writer.margin() + 180, writer.y(), 560, 24,
                    assistance.getProduitAssistance() != null ? value(assistance.getProduitAssistance().getPrestations(), "-") : "-",
                    false, null);
            writer.moveDown(24);
        }
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
                labels.putIfAbsent(garantie.getGarantie().getCode().toUpperCase(Locale.ROOT), garantie.getGarantie().getLibelle());
            }
        }
        return labels;
    }

    private Map<String, List<ContratGarantie>> garantiesByCode(Contrat contrat, Vehicule vehicule) {
        Map<String, List<ContratGarantie>> map = new LinkedHashMap<>();
        for (ContratGarantie garantie : contrat.getGaranties() == null ? List.<ContratGarantie>of() : contrat.getGaranties()) {
            if (garantie.getGarantie() == null || garantie.getGarantie().getCode() == null) {
                continue;
            }
            if (garantie.getVehicule() != null && !garantie.getVehicule().getId().equals(vehicule.getId())) {
                continue;
            }
            if (garantie.getVehicule() == null && garantie.getRemorque() != null) {
                continue;
            }
            if (isSelectedGarantie(garantie)) {
                map.computeIfAbsent(garantie.getGarantie().getCode().toUpperCase(Locale.ROOT), ignored -> new ArrayList<>()).add(garantie);
            }
        }
        return map;
    }

    private String markerFor(String code, Map<String, List<ContratGarantie>> garanties, List<AssistanceContrat> assistances, Vehicule vehicule) {
        if ("ASSISTANCE".equals(code)) {
            return assistances.stream()
                    .filter(assistance -> assistance.getVehicule() != null && assistance.getVehicule().getId().equals(vehicule.getId()))
                    .map(AssistanceContrat::getProduit)
                    .filter(value -> value != null && !value.isBlank())
                    .collect(Collectors.joining(" / "));
        }
        if (!garanties.containsKey(code)) {
            return "";
        }
        if ("DV".equals(code)) {
            return garanties.get(code).stream()
                    .map(ContratGarantie::getTauxFranchise)
                    .filter(value -> value != null && value.compareTo(BigDecimal.ZERO) > 0)
                    .findFirst()
                    .map(value -> "FR" + percent(value))
                    .orElse("X");
        }
        return "X";
    }

    private String franchiseFor(Contrat contrat, Vehicule vehicule, String code) {
        return garantiesByCode(contrat, vehicule).getOrDefault(code, List.of()).stream()
                .map(this::franchiseText)
                .filter(value -> !value.isBlank())
                .distinct()
                .collect(Collectors.joining(" / "));
    }

    private String franchiseText(ContratGarantie garantie) {
        BigDecimal taux = nullToZero(garantie.getTauxFranchise());
        BigDecimal min = nullToZero(garantie.getFranchiseMinimale());
        if (taux.compareTo(BigDecimal.ZERO) == 0 && min.compareTo(BigDecimal.ZERO) == 0) {
            return "";
        }
        if (taux.compareTo(BigDecimal.ZERO) > 0 && min.compareTo(BigDecimal.ZERO) == 0) {
            return percent(taux);
        }
        if (taux.compareTo(BigDecimal.ZERO) == 0) {
            return number(min) + " DH";
        }
        return percent(taux) + " avec minimum " + number(min) + " DH";
    }

    private List<AssistanceContrat> activeAssistancesFor(Contrat contrat, List<Vehicule> vehicules) {
        Set<Long> vehiculeIds = vehicules.stream().map(Vehicule::getId).collect(Collectors.toSet());
        return (contrat.getAssistances() == null ? List.<AssistanceContrat>of() : contrat.getAssistances()).stream()
                .filter(assistance -> Boolean.TRUE.equals(assistance.getActif()))
                .filter(assistance -> assistance.getVehicule() != null && vehiculeIds.contains(assistance.getVehicule().getId()))
                .toList();
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

    private BigDecimal totalVehicule(Contrat contrat, Vehicule vehicule) {
        return (contrat.getGaranties() == null ? List.<ContratGarantie>of() : contrat.getGaranties()).stream()
                .filter(garantie -> garantie.getVehicule() != null && garantie.getVehicule().getId().equals(vehicule.getId()))
                .map(ContratGarantie::getPrime)
                .map(this::nullToZero)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal totalAssistance(List<AssistanceContrat> assistances, Vehicule vehicule) {
        return assistances.stream()
                .filter(assistance -> assistance.getVehicule() != null && assistance.getVehicule().getId().equals(vehicule.getId()))
                .map(AssistanceContrat::getPrimeTotale)
                .map(this::nullToZero)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private String resolveAssure(Contrat contrat) {
        return resolveClient(contrat) == null ? "-" : clientLabel(resolveClient(contrat));
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
        if (client == null) {
            return "";
        }
        if (client.getRaisonSociale() != null && !client.getRaisonSociale().isBlank()) {
            return client.getRaisonSociale();
        }
        return ((client.getNom() == null ? "" : client.getNom()) + " " + (client.getPrenom() == null ? "" : client.getPrenom())).trim();
    }

    private String usageLabel(Vehicule vehicule) {
        if (vehicule == null || vehicule.getUsage() == null) {
            return "";
        }
        String code = value(vehicule.getUsage().getCode(), "");
        if (!code.isBlank() && resolveClient(vehicule.getContrat()) != null && resolveClient(vehicule.getContrat()).getCategorieClient() != null) {
            String categoryCode = value(resolveClient(vehicule.getContrat()).getCategorieClient().getCode(), "");
            if ("LOCATION".equalsIgnoreCase(categoryCode)) {
                return "LOCATION - " + code;
            }
        }
        return value(code, vehicule.getUsage().getLibelle());
    }

    private String pfOrPtc(Vehicule vehicule) {
        if (vehicule == null) {
            return "";
        }
        if (vehicule.getPtc() != null && !vehicule.getPtc().isBlank()) {
            return vehicule.getPtc();
        }
        if (vehicule.getSousClasse() != null && !vehicule.getSousClasse().isBlank()) {
            return vehicule.getSousClasse();
        }
        return value(vehicule.getPuissanceFiscale(), "");
    }

    private List<Vehicule> sortedVehicules(List<Vehicule> vehicules) {
        return vehicules.stream()
                .sorted(Comparator.comparing((Vehicule v) -> usageLabel(v), String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(v -> value(v.getImmatriculation(), ""), String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    private BigDecimal nullToZero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private static float sum(float[] values, int fromInclusive, int toExclusive) {
        float total = 0;
        for (int i = fromInclusive; i < toExclusive; i++) {
            total += values[i];
        }
        return total;
    }

    private static String value(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    private static String formatDate(java.time.LocalDate date) {
        return date == null ? "" : date.format(DateTimeFormatter.ofPattern("dd/MM/yyyy"));
    }

    private static String formatDateTime(java.time.LocalDateTime date) {
        return date == null ? "" : date.format(DateTimeFormatter.ofPattern("dd/MM/yyyy"));
    }

    private static String amountOrEmpty(BigDecimal value) {
        return value == null || value.compareTo(BigDecimal.ZERO) == 0 ? "" : amount(value);
    }

    private static String amount(BigDecimal value) {
        return number(value);
    }

    private static String moneyOrEmpty(BigDecimal value) {
        return value == null || value.compareTo(BigDecimal.ZERO) == 0 ? "" : money(value);
    }

    private static String money(BigDecimal value) {
        return number(value) + " DH";
    }

    private static String percent(BigDecimal value) {
        return number(value) + "%";
    }

    private static String number(BigDecimal value) {
        NumberFormat format = NumberFormat.getNumberInstance(Locale.FRANCE);
        format.setMinimumFractionDigits(0);
        format.setMaximumFractionDigits(2);
        return format.format(value == null ? BigDecimal.ZERO : value);
    }

    private static final class Writer {
        private final PDDocument document;
        private PDPageContentStream content;
        private float y;
        private final float margin = 18;
        private float pageWidth;
        private float pageHeight;

        private Writer(PDDocument document) throws IOException {
            this.document = document;
            newPage();
        }

        private float y() {
            return y;
        }

        private float margin() {
            return margin;
        }

        private float pageWidth() {
            return pageWidth;
        }

        private void section(String text) throws IOException {
            ensureRows(1, 18);
            text(text, margin, y, PDType1Font.HELVETICA_BOLD, 11, Color.BLACK, pageWidth - margin * 2);
            moveDown(20);
        }

        private void rect(float x, float y, float width, float height, Color fill, Color stroke) throws IOException {
            if (fill != null) {
                content.setNonStrokingColor(fill);
                content.addRect(x, y, width, height);
                content.fill();
            }
            if (stroke != null) {
                content.setStrokingColor(stroke);
                content.addRect(x, y, width, height);
                content.stroke();
            }
        }

        private void cell(float x, float topY, float width, float height, String text, boolean bold, Color fill) throws IOException {
            ensureRows(1, height);
            rect(x, topY - height, width, height, fill, TABLE_BORDER);
            PDType1Font font = bold ? PDType1Font.HELVETICA_BOLD : PDType1Font.HELVETICA;
            String[] lines = text == null ? new String[]{""} : text.split("\\n", -1);
            float lineHeight = 10.5f;
            float firstBaseline = topY - (height / 2) + ((lines.length - 1) * lineHeight / 2) - 3;
            for (int i = 0; i < lines.length; i++) {
                center(lines[i], x + 3, firstBaseline - (i * lineHeight), width - 6, font, 8.5f, Color.BLACK);
            }
        }

        private void cellRight(float x, float topY, float width, float height, String text, boolean bold, Color fill) throws IOException {
            ensureRows(1, height);
            rect(x, topY - height, width, height, fill, TABLE_BORDER);
            right(text, x + 3, topY - (height / 2) - 3, width - 6, bold ? PDType1Font.HELVETICA_BOLD : PDType1Font.HELVETICA, 8.5f, Color.BLACK);
        }

        private void text(String text, float x, float y, PDType1Font font, float size, Color color, float maxWidth) throws IOException {
            content.beginText();
            content.setNonStrokingColor(color);
            content.setFont(font, size);
            content.newLineAtOffset(x, y);
            content.showText(fit(text, font, size, maxWidth));
            content.endText();
        }

        private void center(String text, float x, float y, float width, PDType1Font font, float size, Color color) throws IOException {
            String fitted = fit(text, font, size, width);
            float textWidth = font.getStringWidth(safe(fitted)) / 1000 * size;
            text(fitted, x + Math.max(0, (width - textWidth) / 2), y, font, size, color, width);
        }

        private void right(String text, float x, float y, float width, PDType1Font font, float size, Color color) throws IOException {
            String fitted = fit(text, font, size, width);
            float textWidth = font.getStringWidth(safe(fitted)) / 1000 * size;
            text(fitted, x + Math.max(0, width - textWidth), y, font, size, color, width);
        }

        private void moveDown(float value) {
            y -= value;
        }

        private void ensureRows(int rows, float rowHeight) throws IOException {
            if (y - (rows * rowHeight) >= 45) {
                return;
            }
            content.close();
            newPage();
        }

        private void close() throws IOException {
            content.close();
        }

        private void newPage() throws IOException {
            PDPage page = new PDPage(new PDRectangle(PDRectangle.A4.getHeight(), PDRectangle.A4.getWidth()));
            document.addPage(page);
            content = new PDPageContentStream(document, page);
            pageWidth = page.getMediaBox().getWidth();
            pageHeight = page.getMediaBox().getHeight();
            y = pageHeight - margin;
        }

        private String fit(String text, PDType1Font font, float size, float maxWidth) throws IOException {
            String clean = safe(text);
            if (font.getStringWidth(clean) / 1000 * size <= maxWidth) {
                return clean;
            }
            while (clean.length() > 3 && font.getStringWidth(clean + "...") / 1000 * size > maxWidth) {
                clean = clean.substring(0, clean.length() - 1);
            }
            return clean + "...";
        }

        private static String safe(String text) {
            String clean = (text == null ? "" : text)
                    .replace('\n', ' ')
                    .replace('\r', ' ')
                    .replace('\t', ' ')
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
}
