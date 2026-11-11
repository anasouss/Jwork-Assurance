package com.assurance.service;

import com.assurance.dto.request.ConventionProductionFilter;
import com.assurance.dto.response.ConventionProductionResponse;
import com.assurance.entity.ElementFacturable;
import com.assurance.entity.Quittance;
import com.assurance.enums.ModeReglementConvention;
import com.assurance.enums.NatureElementFacturable;
import com.assurance.enums.StatutElementFacturable;
import com.assurance.enums.StatutMouvementContrat;
import com.assurance.enums.TypeContrat;
import com.assurance.exception.BadRequestException;
import com.assurance.repository.ElementFacturableRepository;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ConventionProductionService {
    private final ElementFacturableRepository elements;
    private final FacturationConventionService billing;
    private final ConventionBillingDetailsService details;

    @Transactional(readOnly = true)
    public ConventionProductionResponse search(Long agency, ConventionProductionFilter filter, int page, int size) {
        var result = elements.findAll(specification(agency, filter), PageRequest.of(Math.max(0, page),
                Math.min(100, Math.max(1, size)), Sort.by(Sort.Direction.DESC, "dateDebut", "id")));
        return new ConventionProductionResponse(result.getContent().stream().map(this::row).toList(),
                result.getTotalElements(), result.getTotalPages(), result.getNumber());
    }

    @Transactional(readOnly = true)
    public byte[] export(Long agency, ConventionProductionFilter filter) {
        var rows = elements.findAll(specification(agency, filter), Sort.by(Sort.Direction.DESC, "dateDebut", "id"))
                .stream().map(this::row).toList();
        try (var workbook = new XSSFWorkbook(); var output = new ByteArrayOutputStream()) {
            var sheet = workbook.createSheet("Production conventions");
            var numberStyle = workbook.createCellStyle();
            numberStyle.setDataFormat(workbook.createDataFormat().getFormat("#,##0.00"));
            var headers = new ArrayList<String>();
            if (filter.getConventionId() == null) headers.add("Convention");
            headers.add("Quittance N°");
            if (filter.getCompagnieId() == null) headers.add("Cie");
            headers.addAll(List.of("Police N°", "Mouvement", "Assure", "Vehicule", "Date d'effet", "Date d'expiration",
                    "Prime nette", "Taxes", "Montant TTC", "Mode", "Montant client"));
            var header = sheet.createRow(0);
            for (int index = 0; index < headers.size(); index++) header.createCell(index).setCellValue(headers.get(index));
            int index = 1;
            for (var source : rows) {
                List<Object> values = new ArrayList<>();
                if (filter.getConventionId() == null) values.add(source.convention());
                values.add(source.numeroQuittance());
                if (filter.getCompagnieId() == null) values.add(source.compagnie());
                values.addAll(java.util.Arrays.asList(source.numeroPolice(), source.mouvement(), source.assure(), source.vehicule(),
                        date(source.dateEffet()), date(source.dateExpiration()), source.primeNette(), source.taxes(), source.montantTtc(),
                        source.mode() == null ? null : source.mode().name(), source.montantClient()));
                var target = sheet.createRow(index++);
                for (int column = 0; column < values.size(); column++) {
                    var cell = target.createCell(column);
                    Object value = values.get(column);
                    if (value instanceof BigDecimal amount) {
                        cell.setCellValue(amount.doubleValue());
                        cell.setCellStyle(numberStyle);
                    } else cell.setCellValue(value == null ? "" : value.toString());
                }
            }
            sheet.createFreezePane(0, 1);
            sheet.setAutoFilter(new org.apache.poi.ss.util.CellRangeAddress(0, Math.max(0, rows.size()), 0, headers.size() - 1));
            for (int column = 0; column < headers.size(); column++) sheet.setColumnWidth(column, 23 * 256);
            workbook.write(output);
            return output.toByteArray();
        } catch (java.io.IOException exception) {
            throw new IllegalStateException("Export de la production impossible", exception);
        }
    }

    private Specification<ElementFacturable> specification(Long agency, ConventionProductionFilter filter) {
        if (filter.getDateDu() == null || filter.getDateAu() == null || filter.getDateDu().isAfter(filter.getDateAu())) {
            throw new BadRequestException("Selectionnez une periode de production valide");
        }
        if (!List.of("EFFET", "EMISSION").contains(filter.getTypeDate())) throw new BadRequestException("Critere de date invalide");
        return (root, query, cb) -> {
            var contract = root.join("contrat");
            var movement = root.join("mouvementContrat");
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(root.get("agence").get("id"), agency));
            predicates.add(cb.equal(contract.get("typeContrat"), TypeContrat.CONVENTION));
            predicates.add(cb.isFalse(contract.get("brouillon")));
            predicates.add(cb.isFalse(contract.get("prospection")));
            predicates.add(cb.equal(movement.get("statut"), StatutMouvementContrat.VALIDE));
            predicates.add(root.get("nature").in(NatureElementFacturable.CONTRAT, NatureElementFacturable.MOUVEMENT_CONTRAT));
            predicates.add(cb.isTrue(root.get("actif")));
            predicates.add(cb.not(root.get("statut").in(StatutElementFacturable.BROUILLON, StatutElementFacturable.ANNULE)));
            if (filter.getConventionId() != null) predicates.add(cb.equal(contract.get("convention").get("id"), filter.getConventionId()));
            if (filter.getCompagnieId() != null) predicates.add(cb.equal(contract.get("compagnieAssurance").get("id"), filter.getCompagnieId()));
            if (filter.getMode() != null) {
                predicates.add(cb.or(cb.equal(movement.get("modeReglementConvention"), filter.getMode()),
                        cb.and(cb.isNull(movement.get("modeReglementConvention")),
                                cb.equal(cb.lower(cb.trim(contract.get("modeReglement"))), filter.getMode().name().toLowerCase(java.util.Locale.ROOT)))));
            }
            if ("EFFET".equals(filter.getTypeDate())) {
                predicates.add(cb.between(root.get("dateDebut"), filter.getDateDu(), filter.getDateAu()));
            } else {
                // Emission means creation of the source receipt, not validation of the movement.
                var receipt = query.subquery(Long.class);
                var q = receipt.from(Quittance.class);
                receipt.select(q.get("id")).where(cb.equal(q.get("elementFacturable"), root), cb.isTrue(q.get("globale")),
                        cb.isFalse(q.get("alternative")),
                        cb.greaterThanOrEqualTo(q.get("createdAt"), filter.getDateDu().atStartOfDay()),
                        cb.lessThan(q.get("createdAt"), filter.getDateAu().plusDays(1).atStartOfDay()));
                predicates.add(cb.exists(receipt));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    private ConventionProductionResponse.Row row(ElementFacturable element) {
        var contract = element.getContrat();
        var movement = element.getMouvementContrat();
        var source = details.details(element);
        var mode = movement.getModeReglementConvention() == null ? ConventionPaymentPolicy.inheritedMode(contract) : movement.getModeReglementConvention();
        return new ConventionProductionResponse.Row(element.getId(), contract.getConvention() == null ? null : contract.getConvention().getIntitule(),
                source.numeroQuittance(), contract.getCompagnieAssurance() == null ? null : contract.getCompagnieAssurance().getNom(),
                contract.getNumeroPolice(), details.movementLabel(movement), source.assure(), source.vehicule(), element.getDateDebut(), element.getDateFin(),
                zero(element.getPrimeNette()), zero(element.getTaxe()).add(zero(element.getTaxeParafiscale())), zero(element.getPrimeTotale()),
                mode, mode == ModeReglementConvention.FACTURE ? billing.elementBulletin(element) : mode == ModeReglementConvention.BUREAU ? element.getPrimeTotale() : null);
    }

    private BigDecimal zero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private String date(java.time.LocalDate value) {
        return value == null ? "" : value.format(DateTimeFormatter.ofPattern("dd/MM/yyyy"));
    }
}
