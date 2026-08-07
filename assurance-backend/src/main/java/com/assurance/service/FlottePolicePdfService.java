package com.assurance.service;

import com.assurance.dto.response.ClientResponse;
import com.assurance.dto.response.ContratResponse;
import com.assurance.dto.response.AssistanceContratResponse;
import com.assurance.dto.response.QuittanceResponse;
import com.assurance.enums.TypeContrat;
import com.assurance.exception.BadRequestException;
import com.itextpdf.io.font.constants.StandardFonts;
import com.itextpdf.kernel.colors.DeviceRgb;
import com.itextpdf.kernel.font.PdfFontFactory;
import com.itextpdf.kernel.geom.PageSize;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.borders.SolidBorder;
import com.itextpdf.layout.element.Cell;
import com.itextpdf.layout.element.AreaBreak;
import com.itextpdf.layout.element.Paragraph;
import com.itextpdf.layout.element.Table;
import com.itextpdf.layout.property.AreaBreakType;
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
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class FlottePolicePdfService {

    private static final DeviceRgb INK = new DeviceRgb(15, 23, 42);
    private static final DeviceRgb ACCENT = new DeviceRgb(28, 55, 92);
    private static final DeviceRgb BORDER = new DeviceRgb(51, 65, 85);
    private static final DeviceRgb SOFT_BORDER = new DeviceRgb(203, 213, 225);
    private static final DeviceRgb HEADER_BG = new DeviceRgb(241, 245, 249);
    private static final DeviceRgb SELECTED_BG = new DeviceRgb(236, 253, 245);
    private static final DeviceRgb ASSISTANCE_BG = new DeviceRgb(255, 251, 235);
    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final ContratService contratService;

    @Transactional(readOnly = true)
    public byte[] generate(Long agenceId, Long contratId, Long mouvementId) {
        ContratResponse contrat = contratService.get(agenceId, contratId, mouvementId);
        if (contrat.getTypeContrat() != TypeContrat.FLOTTE) {
            throw new BadRequestException("Le document police flotte est réservé aux contrats flotte");
        }

        ContratResponse.MouvementView mouvement = resolveMouvement(contrat, mouvementId);
        try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            PdfDocument pdf = new PdfDocument(new PdfWriter(output));
            Document document = new Document(pdf, PageSize.A4.rotate());
            document.setMargins(14, 12, 14, 12);
            document.setFont(PdfFontFactory.createFont(StandardFonts.HELVETICA));

            writeHeader(document, contrat, mouvement);
            writeContext(document, contrat, mouvement);
            writeTariff(document, contrat);
            writeLegend(document, contrat.getGaranties());

            int section = 2;
            if (writeFranchises(document, contrat, section)) {
                section++;
            }
            writeQuittance(document, contrat.getQuittanceGenerale(), contrat.getAssistances(), section);

            document.close();
            return output.toByteArray();
        } catch (Exception exception) {
            throw new BadRequestException("Génération du PDF de la police flotte impossible");
        }
    }

    public void appendClientDocumentAnnex(
            Document document,
            Long agenceId,
            Long contratId,
            Long mouvementId,
            int annexNumber
    ) {
        if (mouvementId == null) {
            throw new BadRequestException("Le mouvement de l'annexe flotte " + annexNumber + " est introuvable");
        }
        ContratResponse contrat = contratService.get(agenceId, contratId, mouvementId);
        if (contrat.getTypeContrat() != TypeContrat.FLOTTE) {
            throw new BadRequestException("L'annexe flotte est réservée aux contrats flotte");
        }

        document.getPdfDocument().setDefaultPageSize(PageSize.A4.rotate());
        document.add(new AreaBreak(AreaBreakType.NEXT_PAGE));
        document.add(new Paragraph("ANNEXE " + annexNumber + " - POLICE FLOTTE")
                .setBold()
                .setFontSize(12)
                .setFontColor(INK)
                .setTextAlignment(TextAlignment.CENTER)
                .setMarginBottom(2));
        document.add(new Paragraph("Police N° " + safe(value(contrat.getNumeroPolice(), "-")))
                .setBold()
                .setFontSize(8)
                .setFontColor(ACCENT)
                .setTextAlignment(TextAlignment.CENTER)
                .setMarginTop(0)
                .setMarginBottom(7));
        writeTariff(document, contrat);
        writeLegend(document, contrat.getGaranties());
    }

    private ContratResponse.MouvementView resolveMouvement(ContratResponse contrat, Long mouvementId) {
        List<ContratResponse.MouvementView> mouvements = list(contrat.getMouvements());
        if (mouvementId != null) {
            return mouvements.stream()
                    .filter(item -> mouvementId.equals(item.getId()))
                    .findFirst()
                    .orElseThrow(() -> new BadRequestException("Mouvement introuvable pour ce contrat"));
        }
        return mouvements.stream()
                .filter(item -> !"ANNULE".equalsIgnoreCase(value(item.getStatut(), "")))
                .max(Comparator.comparing(ContratResponse.MouvementView::getId, Comparator.nullsLast(Long::compareTo)))
                .orElse(null);
    }

    private void writeHeader(Document document, ContratResponse contrat, ContratResponse.MouvementView mouvement) throws Exception {
        Table title = new Table(new float[]{1})
                .setWidth(UnitValue.createPercentValue(38))
                .setHorizontalAlignment(HorizontalAlignment.CENTER);
        title.addCell(new Cell()
                .add(new Paragraph("POLICE FLOTTE AUTOMOBILE")
                        .setBold().setFontSize(13).setTextAlignment(TextAlignment.CENTER).setFontColor(INK))
                .add(new Paragraph("ACTE N° " + movementNumber(mouvement) + " : " + movementLabel(mouvement))
                        .setBold().setFontSize(9).setTextAlignment(TextAlignment.CENTER).setFontColor(INK))
                .setBackgroundColor(HEADER_BG)
                .setBorder(new SolidBorder(BORDER, 1.1f))
                .setPaddingTop(5)
                .setPaddingBottom(5));
        document.add(title);
        document.add(new Paragraph(" ").setMarginBottom(3));
    }

    private void writeContext(Document document, ContratResponse contrat, ContratResponse.MouvementView mouvement) {
        ClientResponse subscriber = subscriber(contrat);
        boolean subscriberPays = isSubscriberPayer(contrat, subscriber);
        Paragraph billing = new Paragraph();
        if (!subscriberPays) {
            billing.add(new Text("Payeur : ").setBold().setFontColor(ACCENT))
                    .add(safe(value(contrat.getPayeurPrimeNom(), "-")))
                    .add("    ");
        }
        billing.add(new Text("Facturation : ").setBold().setFontColor(ACCENT))
                .add(safe(billingMode(contrat)));
        Table info = new Table(new float[]{7, 3}).setWidth(UnitValue.createPercentValue(100));
        info.addCell(new Cell()
                .add(labelValue("Assuré : ", clientName(subscriber)))
                .add(labelValue("Adresse : ", clientAddress(subscriber)))
                .add(billing)
                .setFontSize(7.5f)
                .setBorder(new SolidBorder(SOFT_BORDER, 0.8f))
                .setPadding(5));
        info.addCell(new Cell()
                .add(new Paragraph("Police N° " + safe(value(contrat.getNumeroPolice(), "-"))).setBold().setFontColor(ACCENT))
                .add(new Paragraph("Date d'effet " + formatDate(mouvement == null ? contrat.getDateEffet() : mouvement.getDateEffet())
                        + "  Date d'expiration " + formatDate(mouvement == null ? contrat.getDateEcheance() : mouvement.getDateEcheance())))
                .setFontSize(7.5f)
                .setTextAlignment(TextAlignment.RIGHT)
                .setBorder(new SolidBorder(SOFT_BORDER, 0.8f))
                .setPadding(5));
        document.add(info);

        Table sectionTitle = new Table(new float[]{1, 1}).setWidth(UnitValue.createPercentValue(100)).setMarginTop(5).setMarginBottom(2);
        sectionTitle.addCell(borderlessCell("I. Le tarif", TextAlignment.LEFT).setBold().setFontSize(9));
        sectionTitle.addCell(borderlessCell(value(contrat.getNumeroDossier(), "#" + contrat.getId()), TextAlignment.RIGHT)
                .setBold().setFontSize(6.5f).setFontColor(ACCENT));
        document.add(sectionTitle);
    }

    private void writeTariff(Document document, ContratResponse contrat) {
        List<Target> targets = targets(contrat);
        List<ContratResponse.GarantieView> guarantees = vehicleGuarantees(contrat.getGaranties());
        List<String> codes = guaranteeCodes(guarantees);
        boolean hasDcCapital = codes.contains("DC");
        boolean showAssistance = !list(contrat.getAssistances()).isEmpty();
        int valueColumns = hasDcCapital ? 4 : 3;
        int guaranteeColumns = Math.max(1, codes.size() + (showAssistance ? 2 : 0));
        int columnCount = 8 + valueColumns + guaranteeColumns;
        float[] widths = tariffWidths(codes.size(), hasDcCapital, showAssistance);
        Table table = new Table(widths).setWidth(UnitValue.createPercentValue(100));

        addHeader(table, "Usage", 2, 1, HEADER_BG);
        addHeader(table, "Marque", 2, 1, HEADER_BG);
        addHeader(table, "N°\nd'immatric", 2, 1, HEADER_BG);
        addHeader(table, "N°\nattestation", 2, 1, HEADER_BG);
        addHeader(table, "Date de\nMC", 2, 1, HEADER_BG);
        addHeader(table, "PF/PTC", 2, 1, HEADER_BG);
        addHeader(table, "ÉNERGIE", 2, 1, HEADER_BG);
        addHeader(table, "VALEURS", 1, valueColumns, HEADER_BG);
        addHeader(table, "GARANTIES À ASSURER", 1, guaranteeColumns, SELECTED_BG);
        addHeader(table, "Montant total", 2, 1, HEADER_BG);
        addHeader(table, "Valeur à\nneuf", 1, 1, HEADER_BG);
        addHeader(table, "Valeur\nvénale", 1, 1, HEADER_BG);
        addHeader(table, "Valeur des\nglaces", 1, 1, HEADER_BG);
        if (hasDcCapital) {
            addHeader(table, "Capital\nDC", 1, 1, HEADER_BG);
        }
        if (codes.isEmpty() && !showAssistance) {
            addHeader(table, "-", 1, 1, SELECTED_BG);
        } else {
            codes.forEach(code -> addHeader(table, code, 1, 1, SELECTED_BG));
        }
        if (showAssistance) {
            addHeader(table, "ASSISTANCE", 1, 1, ASSISTANCE_BG);
            addHeader(table, "PRIME\nTTC", 1, 1, ASSISTANCE_BG);
        }

        BigDecimal rowsTotal = BigDecimal.ZERO;
        for (Target target : targets) {
            List<ContratResponse.GarantieView> rowGuarantees = guaranteesFor(guarantees, target);
            QuittanceResponse.TargetSummary summary = summaryFor(contrat, target);
            BigDecimal assistancePrime = assistancePrimeFor(contrat, target);
            BigDecimal rowTotal = (summary == null ? BigDecimal.ZERO : zero(summary.getPrimeTotale())).add(assistancePrime);
            rowsTotal = rowsTotal.add(rowTotal);

            table.addCell(valueCell(target.usageLabel(), TextAlignment.LEFT));
            table.addCell(valueCell(target.marque(), TextAlignment.LEFT));
            table.addCell(valueCell(target.immatriculation(), TextAlignment.CENTER));
            table.addCell(valueCell(target.numeroAttestation(), TextAlignment.CENTER));
            table.addCell(valueCell(formatDate(target.dateMiseEnCirculation()), TextAlignment.CENTER));
            table.addCell(valueCell(target.pfOuPtc(), TextAlignment.CENTER));
            table.addCell(valueCell(target.energie(), TextAlignment.CENTER));
            table.addCell(valueCell(formatMoneyOrEmpty(target.valeurNeuf()), TextAlignment.RIGHT));
            table.addCell(valueCell(formatMoneyOrEmpty(target.valeurVenale()), TextAlignment.RIGHT));
            table.addCell(valueCell(formatMoneyOrEmpty(target.valeurGlace()), TextAlignment.RIGHT));
            if (hasDcCapital) {
                table.addCell(valueCell(formatMoneyOrEmpty(capitalFor(rowGuarantees, "DC")), TextAlignment.RIGHT));
            }
            if (codes.isEmpty() && !showAssistance) {
                table.addCell(valueCell("-", TextAlignment.CENTER));
            } else {
                codes.forEach(code -> table.addCell(guaranteeCell(markerFor(rowGuarantees, code))));
            }
            if (showAssistance) {
                table.addCell(assistanceCell(assistanceFor(contrat, target)));
                table.addCell(valueCell(formatMoneyOrEmpty(assistancePrime), TextAlignment.RIGHT)
                        .setBackgroundColor(ASSISTANCE_BG));
            }
            table.addCell(valueCell(formatMoney(rowTotal), TextAlignment.RIGHT).setBold());
        }

        table.addCell(new Cell(1, columnCount - 1)
                .add(new Paragraph("TOTAL").setBold())
                .setTextAlignment(TextAlignment.CENTER)
                .setBorder(new SolidBorder(BORDER, 0.8f))
                .setPadding(2));
        table.addCell(valueCell(formatMoney(rowsTotal), TextAlignment.RIGHT).setBold());
        document.add(table);
    }

    private void writeLegend(Document document, List<ContratResponse.GarantieView> guarantees) {
        List<ContratResponse.GarantieView> vehicleGuarantees = vehicleGuarantees(guarantees);
        List<String> codes = guaranteeCodes(vehicleGuarantees);
        if (codes.isEmpty()) {
            return;
        }
        Paragraph legend = new Paragraph().setFontSize(5.5f).setFontColor(ACCENT).setMarginTop(3).setMarginBottom(4);
        for (int index = 0; index < codes.size(); index++) {
            String code = codes.get(index);
            if (index > 0) {
                legend.add(" | ");
            }
            legend.add(code + ": " + value(vehicleGuarantees.stream()
                    .filter(item -> code.equals(normalize(item.getCode())))
                    .map(ContratResponse.GarantieView::getLibelle)
                    .findFirst().orElse(null), code));
        }
        document.add(legend);
    }

    private boolean writeFranchises(Document document, ContratResponse contrat, int section) {
        List<ContratResponse.VehiculeView> vehicles = list(contrat.getVehicules());
        List<ContratResponse.GarantieView> guarantees = vehicleGuarantees(contrat.getGaranties());
        List<String> usages = vehicles.stream()
                .map(item -> value(item.getUsageCode(), item.getUsageLibelle()))
                .filter(item -> !item.isBlank())
                .distinct()
                .toList();
        Map<String, List<String>> rows = new LinkedHashMap<>();
        for (String code : guaranteeCodes(guarantees)) {
            List<String> values = usages.stream().map(usage -> franchiseFor(code, usage, vehicles, guarantees)).toList();
            if (values.stream().anyMatch(item -> !"-".equals(item))) {
                rows.put(code, values);
            }
        }
        if (rows.isEmpty()) {
            return false;
        }

        document.add(new Paragraph(toRoman(section) + ". Les franchises").setBold().setFontSize(9).setMarginTop(4).setMarginBottom(2));
        float[] widths = new float[usages.size() + 1];
        widths[0] = 1.3f;
        for (int index = 1; index < widths.length; index++) {
            widths[index] = 3f;
        }
        Table table = new Table(widths)
                .setWidth(UnitValue.createPercentValue(Math.min(62, 14 + usages.size() * 18)));
        table.addHeaderCell(headerCell("Garanties", HEADER_BG));
        usages.forEach(usage -> table.addHeaderCell(headerCell("Usage " + usage, HEADER_BG)));
        rows.forEach((code, values) -> {
            table.addCell(valueCell(code, TextAlignment.LEFT).setBold());
            values.forEach(item -> table.addCell(valueCell(item, TextAlignment.LEFT)));
        });
        document.add(table);
        return true;
    }

    private void writeQuittance(Document document, QuittanceResponse quittance,
                                List<AssistanceContratResponse> assistances, int section) {
        if (quittance == null || list(quittance.getLignes()).isEmpty()) {
            return;
        }
        List<QuittanceResponse.Ligne> lines = quittance.getLignes().stream()
                .filter(line -> Boolean.TRUE.equals(line.getGlobale()) || zero(line.getPrimeTotale()).compareTo(BigDecimal.ZERO) != 0)
                .toList();
        if (lines.isEmpty()) {
            return;
        }
        document.add(new Paragraph(toRoman(section) + ". Quittance").setBold().setFontSize(9).setMarginTop(4).setMarginBottom(2));
        Table table = new Table(new float[]{2.3f, 1.7f, 1.5f, 1.4f, 1.3f, 1.5f, 1.8f})
                .setWidth(UnitValue.createPercentValue(100));
        for (String header : List.of("Catégorie", "Prime nette", "Taxes", "TPF", "ACC", "CNPAC", "Total")) {
            table.addHeaderCell(headerCell(header, HEADER_BG));
        }
        BigDecimal assistanceNet = list(assistances).stream()
                .map(AssistanceContratResponse::getPrimeNette)
                .map(FlottePolicePdfService::zero)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal assistanceTtc = list(assistances).stream()
                .map(AssistanceContratResponse::getPrimeTotale)
                .map(FlottePolicePdfService::zero)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal assistanceTax = assistanceTtc.subtract(assistanceNet).max(BigDecimal.ZERO);
        for (QuittanceResponse.Ligne line : lines.stream().filter(item -> !Boolean.TRUE.equals(item.getGlobale())).toList()) {
            table.addCell(valueCell(value(line.getCategorie(), "-"), TextAlignment.LEFT));
            table.addCell(valueCell(formatMoney(line.getPrimeNette()), TextAlignment.RIGHT));
            table.addCell(valueCell(formatMoney(line.getTaxe()), TextAlignment.RIGHT));
            table.addCell(valueCell(formatMoney(line.getTaxeParafiscale()), TextAlignment.RIGHT));
            table.addCell(valueCell(formatMoney(line.getAccessoire()), TextAlignment.RIGHT));
            table.addCell(valueCell(formatMoney(line.getCnpac()), TextAlignment.RIGHT));
            table.addCell(valueCell(formatMoney(line.getPrimeTotale()), TextAlignment.RIGHT));
        }
        if (assistanceTtc.compareTo(BigDecimal.ZERO) != 0) {
            table.addCell(valueCell("ASSISTANCE", TextAlignment.LEFT));
            table.addCell(valueCell(formatMoney(assistanceNet), TextAlignment.RIGHT));
            table.addCell(valueCell(formatMoney(assistanceTax), TextAlignment.RIGHT));
            table.addCell(valueCell(formatMoney(BigDecimal.ZERO), TextAlignment.RIGHT));
            table.addCell(valueCell(formatMoney(BigDecimal.ZERO), TextAlignment.RIGHT));
            table.addCell(valueCell(formatMoney(BigDecimal.ZERO), TextAlignment.RIGHT));
            table.addCell(valueCell(formatMoney(assistanceTtc), TextAlignment.RIGHT));
        }
        QuittanceResponse.Ligne total = lines.stream().filter(item -> Boolean.TRUE.equals(item.getGlobale())).findFirst().orElse(null);
        if (total != null) {
            table.addCell(valueCell("TOTAL", TextAlignment.LEFT).setBold());
            table.addCell(valueCell(formatMoney(zero(total.getPrimeNette()).add(assistanceNet)), TextAlignment.RIGHT).setBold());
            table.addCell(valueCell(formatMoney(zero(total.getTaxe()).add(assistanceTax)), TextAlignment.RIGHT).setBold());
            table.addCell(valueCell(formatMoney(total.getTaxeParafiscale()), TextAlignment.RIGHT).setBold());
            table.addCell(valueCell(formatMoney(total.getAccessoire()), TextAlignment.RIGHT).setBold());
            table.addCell(valueCell(formatMoney(total.getCnpac()), TextAlignment.RIGHT).setBold());
            table.addCell(valueCell(formatMoney(zero(total.getPrimeTotale()).add(assistanceTtc)), TextAlignment.RIGHT).setBold());
        }
        document.add(table);
    }

    private List<Target> targets(ContratResponse contrat) {
        List<Target> targets = new ArrayList<>();
        List<ContratResponse.VehiculeView> vehicles = list(contrat.getVehicules());
        for (int index = 0; index < vehicles.size(); index++) {
            ContratResponse.VehiculeView item = vehicles.get(index);
            targets.add(new Target("VEHICULE", index, item.getVehiculeId(), item.getUsageCode(), item.getUsageLibelle(),
                    item.getMarque(), item.getImmatriculation(), item.getNumeroAttestation(), item.getDatePremiereCirculation(),
                    value(item.getPuissanceFiscale(), item.getPtc(), item.getSousClasse()), item.getCarburant(),
                    item.getValeurNeuf(), item.getValeurVenale(), item.getValeurGlace()));
        }
        List<ContratResponse.RemorqueView> trailers = list(contrat.getRemorques());
        for (int index = 0; index < trailers.size(); index++) {
            ContratResponse.RemorqueView item = trailers.get(index);
            targets.add(new Target("REMORQUE", index, item.getRemorqueId(), item.getUsageCode(), item.getUsageLibelle(),
                    item.getMarque(), item.getImmatriculation(), item.getNumeroAttestation(), item.getDateMiseEnCirculation(),
                    item.getPtc(), "", null, item.getValeurAssuree(), null));
        }
        return targets;
    }

    private List<ContratResponse.GarantieView> guaranteesFor(List<ContratResponse.GarantieView> guarantees, Target target) {
        return guarantees.stream().filter(item -> "VEHICULE".equals(target.kind())
                ? Objects.equals(target.id(), item.getVehiculeId())
                : Objects.equals(target.id(), item.getRemorqueId())).toList();
    }

    private QuittanceResponse.TargetSummary summaryFor(ContratResponse contrat, Target target) {
        List<QuittanceResponse.TargetSummary> summaries = list(contrat.getTargetSummaries());
        return summaries.stream().filter(item -> target.kind().equals(item.getKind())
                && ("VEHICULE".equals(target.kind())
                ? Integer.valueOf(target.index()).equals(item.getVehiculeIndex())
                : Integer.valueOf(target.index()).equals(item.getRemorqueIndex()))).findFirst().orElse(null);
    }

    private String assistanceFor(ContratResponse contrat, Target target) {
        if (!"VEHICULE".equals(target.kind())) {
            return "";
        }
        return list(contrat.getAssistances()).stream()
                .filter(item -> Objects.equals(target.id(), item.getVehiculeId()))
                .map(item -> value(item.getProduit(), ""))
                .filter(item -> !item.isBlank())
                .distinct()
                .reduce((left, right) -> left + " / " + right)
                .orElse("");
    }

    private BigDecimal assistancePrimeFor(ContratResponse contrat, Target target) {
        if (!"VEHICULE".equals(target.kind())) {
            return BigDecimal.ZERO;
        }
        return list(contrat.getAssistances()).stream()
                .filter(item -> Objects.equals(target.id(), item.getVehiculeId()))
                .map(AssistanceContratResponse::getPrimeTotale)
                .map(FlottePolicePdfService::zero)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private List<ContratResponse.GarantieView> vehicleGuarantees(List<ContratResponse.GarantieView> guarantees) {
        return list(guarantees).stream().filter(item -> !"PERSONNE".equals(normalize(item.getTypeGarantie()))).toList();
    }

    private List<String> guaranteeCodes(List<ContratResponse.GarantieView> guarantees) {
        List<String> preferred = List.of("RC", "DR", "V", "I", "BG", "DC", "RF", "DV", "RVE", "BOR", "BTP", "VOR", "PF");
        Set<String> present = new LinkedHashSet<>();
        guarantees.stream().map(item -> normalize(item.getCode())).filter(item -> !item.isBlank()).forEach(present::add);
        List<String> result = new ArrayList<>();
        preferred.stream().filter(present::remove).forEach(result::add);
        result.addAll(present.stream().sorted().toList());
        return result;
    }

    private String markerFor(List<ContratResponse.GarantieView> guarantees, String code) {
        ContratResponse.GarantieView guarantee = guarantees.stream()
                .filter(item -> code.equals(normalize(item.getCode())))
                .findFirst().orElse(null);
        if (guarantee == null) {
            return "";
        }
        if ("DV".equals(code) && zero(guarantee.getTauxFranchise()).compareTo(BigDecimal.ZERO) > 0) {
            return "FR" + formatCompact(guarantee.getTauxFranchise()) + "%";
        }
        return "X";
    }

    private BigDecimal capitalFor(List<ContratResponse.GarantieView> guarantees, String code) {
        return guarantees.stream().filter(item -> code.equals(normalize(item.getCode())))
                .map(item -> item.getCapital() == null ? item.getValeurAssuree() : item.getCapital())
                .findFirst().orElse(null);
    }

    private String franchiseFor(
            String code,
            String usage,
            List<ContratResponse.VehiculeView> vehicles,
            List<ContratResponse.GarantieView> guarantees
    ) {
        Set<Long> vehicleIds = new LinkedHashSet<>();
        vehicles.stream()
                .filter(item -> usage.equals(value(item.getUsageCode(), item.getUsageLibelle())))
                .map(ContratResponse.VehiculeView::getVehiculeId)
                .forEach(vehicleIds::add);
        return guarantees.stream()
                .filter(item -> code.equals(normalize(item.getCode())) && vehicleIds.contains(item.getVehiculeId()))
                .map(this::franchiseLabel)
                .filter(item -> !item.isBlank())
                .distinct()
                .reduce((left, right) -> left + " / " + right)
                .orElse("-");
    }

    private String franchiseLabel(ContratResponse.GarantieView guarantee) {
        BigDecimal rate = zero(guarantee.getTauxFranchise());
        BigDecimal minimum = zero(guarantee.getFranchiseMinimale());
        if (rate.compareTo(BigDecimal.ZERO) <= 0 && minimum.compareTo(BigDecimal.ZERO) <= 0) {
            return "";
        }
        if (rate.compareTo(BigDecimal.ZERO) > 0 && minimum.compareTo(BigDecimal.ZERO) > 0) {
            return formatCompact(rate) + " % avec min " + formatCompact(minimum) + " DH";
        }
        return rate.compareTo(BigDecimal.ZERO) > 0 ? formatCompact(rate) + " %" : formatCompact(minimum) + " DH";
    }

    private ClientResponse subscriber(ContratResponse contrat) {
        return list(contrat.getClients()).stream()
                .filter(item -> "SOUSCRIPTEUR".equals(item.getRole()))
                .map(ContratResponse.ClientLink::getClient)
                .findFirst().orElse(null);
    }

    private String clientName(ClientResponse client) {
        return client == null ? "-" : value(client.getNomAffichage(), client.getRaisonSociale(),
                (value(client.getPrenom(), "") + " " + value(client.getNom(), "")).trim());
    }

    private String clientAddress(ClientResponse client) {
        if (client == null) {
            return "-";
        }
        String address = value(client.getAdresse(), "");
        String city = value(client.getVille(), "");
        return address.isBlank() ? value(city, "-") : city.isBlank() ? address : address + ", " + city;
    }

    private boolean isSubscriberPayer(ContratResponse contrat, ClientResponse subscriber) {
        if (contrat.getTypePayeurPrime() == null || "SOUSCRIPTEUR".equals(contrat.getTypePayeurPrime().name())) {
            return true;
        }
        return contrat.getPayeurPrimeClientId() != null && subscriber != null && subscriber.getId() != null
                && contrat.getPayeurPrimeClientId().equals(subscriber.getId());
    }

    private String billingMode(ContratResponse contrat) {
        return contrat.getModeFacturation() != null && "CONSOLIDEE_GROUPE".equals(contrat.getModeFacturation().name())
                ? "Consolidée au groupe"
                : "Directe au payeur";
    }

    private String movementNumber(ContratResponse.MouvementView movement) {
        return movement == null ? "1" : value(movement.getNumeroMouvement(), "1");
    }

    private String movementLabel(ContratResponse.MouvementView movement) {
        return movement == null ? "Affaire nouvelle" : value(movement.getLibelle(), "Affaire nouvelle");
    }

    private Paragraph labelValue(String label, String content) {
        return new Paragraph().add(new Text(label).setBold().setFontColor(ACCENT)).add(safe(content));
    }

    private Cell borderlessCell(String content, TextAlignment alignment) {
        return new Cell().add(new Paragraph(safe(content))).setBorder(null).setPadding(0).setTextAlignment(alignment);
    }

    private void addHeader(Table table, String content, int rowSpan, int colSpan, DeviceRgb background) {
        table.addHeaderCell(new Cell(rowSpan, colSpan)
                .add(new Paragraph(safe(content)).setBold())
                .setTextAlignment(TextAlignment.CENTER)
                .setVerticalAlignment(com.itextpdf.layout.property.VerticalAlignment.MIDDLE)
                .setFontSize(6.1f)
                .setBackgroundColor(background)
                .setBorder(new SolidBorder(BORDER, 0.8f))
                .setPadding(2));
    }

    private Cell headerCell(String content, DeviceRgb background) {
        return new Cell().add(new Paragraph(safe(content)).setBold())
                .setTextAlignment(TextAlignment.CENTER).setFontSize(6.3f)
                .setBackgroundColor(background).setBorder(new SolidBorder(BORDER, 0.8f)).setPadding(2);
    }

    private Cell valueCell(String content, TextAlignment alignment) {
        return new Cell().add(new Paragraph(safe(content)))
                .setTextAlignment(alignment).setFontSize(6.1f)
                .setBorder(new SolidBorder(BORDER, 0.7f)).setPadding(2);
    }

    private Cell guaranteeCell(String content) {
        Cell cell = valueCell(content, TextAlignment.CENTER).setBold();
        if (!content.isBlank()) {
            cell.setBackgroundColor(SELECTED_BG);
        }
        return cell;
    }

    private Cell assistanceCell(String content) {
        return valueCell(content, TextAlignment.CENTER).setBackgroundColor(ASSISTANCE_BG);
    }

    private Cell withBold(Cell cell, boolean bold) {
        return bold ? cell.setBold() : cell;
    }

    private float[] tariffWidths(int codeCount, boolean hasDcCapital, boolean showAssistance) {
        List<Float> widths = new ArrayList<>(List.of(1.0f, 1.5f, 2.3f, 2.0f, 1.35f, 0.9f, 1.15f, 1.35f, 1.35f, 1.35f));
        if (hasDcCapital) {
            widths.add(1.25f);
        }
        int renderedGuarantees = codeCount == 0 && !showAssistance ? 1 : codeCount;
        for (int index = 0; index < renderedGuarantees; index++) {
            widths.add(0.58f);
        }
        if (showAssistance) {
            widths.add(1.4f);
            widths.add(1.25f);
        }
        widths.add(1.55f);
        float[] result = new float[widths.size()];
        for (int index = 0; index < widths.size(); index++) {
            result[index] = widths.get(index);
        }
        return result;
    }

    private static String formatDate(LocalDate date) {
        return date == null ? "-" : date.format(DATE_FORMAT);
    }

    private static String formatMoneyOrEmpty(BigDecimal amount) {
        return amount == null || amount.compareTo(BigDecimal.ZERO) == 0 ? "" : formatMoney(amount);
    }

    private static String formatMoney(BigDecimal amount) {
        DecimalFormat format = decimalFormat("#,##0.00");
        return format.format(zero(amount));
    }

    private static String formatCompact(BigDecimal amount) {
        return decimalFormat("#,##0.####").format(zero(amount));
    }

    private static DecimalFormat decimalFormat(String pattern) {
        DecimalFormatSymbols symbols = new DecimalFormatSymbols(Locale.FRANCE);
        symbols.setGroupingSeparator(' ');
        symbols.setDecimalSeparator(',');
        return new DecimalFormat(pattern, symbols);
    }

    private static BigDecimal zero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private static String normalize(String value) {
        return value(value, "").toUpperCase(Locale.ROOT);
    }

    private static String value(Object... values) {
        for (Object item : values) {
            if (item != null && !String.valueOf(item).trim().isBlank()) {
                return String.valueOf(item).trim();
            }
        }
        return "";
    }

    private static String safe(String value) {
        return value(value, "")
                .replace('\u00A0', ' ')
                .replace('\u202F', ' ')
                .replace('’', '\'')
                .replace('–', '-')
                .replace('—', '-')
                .replaceAll("[^\\u0020-\\u00FF]", " ")
                .trim();
    }

    private static String toRoman(int value) {
        return switch (value) {
            case 1 -> "I";
            case 2 -> "II";
            case 3 -> "III";
            case 4 -> "IV";
            default -> String.valueOf(value);
        };
    }

    private static <T> List<T> list(List<T> values) {
        return values == null ? List.of() : values;
    }

    private record Target(
            String kind,
            int index,
            Long id,
            String usageCode,
            String usageLibelle,
            String marque,
            String immatriculation,
            String numeroAttestation,
            LocalDate dateMiseEnCirculation,
            String pfOuPtc,
            String energie,
            BigDecimal valeurNeuf,
            BigDecimal valeurVenale,
            BigDecimal valeurGlace
    ) {
        private String usageLabel() {
            return value(usageCode, usageLibelle, "-");
        }
    }
}
