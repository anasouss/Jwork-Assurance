package com.assurance.service;

import com.assurance.dto.request.RegistreProductionFilter;
import com.assurance.dto.response.PageMetadata;
import com.assurance.dto.response.RegistreProductionResponse;
import com.assurance.entity.Client;
import com.assurance.entity.Contrat;
import com.assurance.entity.ContratClient;
import com.assurance.entity.MouvementContrat;
import com.assurance.enums.RoleClientContrat;
import com.assurance.enums.StatutMouvementContrat;
import com.assurance.exception.BadRequestException;
import com.assurance.repository.AssistanceContratRepository;
import com.assurance.repository.ContratClientRepository;
import com.assurance.repository.MouvementContratRepository;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.VerticalAlignment;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Predicate;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RegistreProductionService {

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final Set<StatutMouvementContrat> REGISTER_STATUSES = Set.of(
            StatutMouvementContrat.VALIDE,
            StatutMouvementContrat.ANNULE
    );

    private final MouvementContratRepository mouvementContratRepository;
    private final ContratClientRepository contratClientRepository;
    private final AssistanceContratRepository assistanceContratRepository;

    @Transactional(readOnly = true)
    public RegistreProductionResponse search(Long agenceId, RegistreProductionFilter filter, int page, int size) {
        validate(filter);
        Page<MouvementContrat> result = findPage(agenceId, filter, page, Math.min(Math.max(size, 1), 100));
        List<RegistreProductionResponse.Ligne> rows = mapRows(result.getContent());
        MouvementContratRepository.RegistreProductionTotals values = mouvementContratRepository.summarizeRegistre(
                agenceId, filter.getTypeDate(), filter.getDateDu(), filter.getDateAu(),
                filter.getBrancheId(), filter.getCompagnieId(), filter.getCategorie(),
                filter.getTypeContrat(), filter.getStatut(), normalizedSearch(filter.getSearch())
        );
        BigDecimal assistanceTtc = assistanceContratRepository.sumRegistreTtc(
                agenceId, filter.getTypeDate(), filter.getDateDu(), filter.getDateAu(),
                filter.getBrancheId(), filter.getCompagnieId(), filter.getCategorie(),
                filter.getTypeContrat(), filter.getStatut(), normalizedSearch(filter.getSearch())
        );

        return RegistreProductionResponse.builder()
                .items(rows)
                .page(PageMetadata.from(result))
                .totaux(toTotals(values, assistanceTtc))
                .build();
    }

    @Transactional(readOnly = true)
    public byte[] export(Long agenceId, RegistreProductionFilter filter) {
        validate(filter);
        List<RegistreProductionResponse.Ligne> rows = new ArrayList<>();
        int page = 0;
        Page<MouvementContrat> result;
        do {
            result = findPage(agenceId, filter, page++, 200);
            rows.addAll(mapRows(result.getContent()));
        } while (!result.isLast());
        return createWorkbook(rows);
    }

    private Page<MouvementContrat> findPage(
            Long agenceId,
            RegistreProductionFilter filter,
            int page,
            int size
    ) {
        Sort.Direction direction = "asc".equalsIgnoreCase(filter.getSortDirection())
                ? Sort.Direction.ASC : Sort.Direction.DESC;
        Sort sort = Sort.by(direction, sortProperty(filter))
                .and(Sort.by(Sort.Direction.DESC, "id"));
        return mouvementContratRepository.searchRegistre(
                agenceId, filter.getTypeDate(), filter.getDateDu(), filter.getDateAu(),
                filter.getBrancheId(), filter.getCompagnieId(), filter.getCategorie(),
                filter.getTypeContrat(), filter.getStatut(), normalizedSearch(filter.getSearch()),
                PageRequest.of(Math.max(page, 0), size, sort)
        );
    }

    private List<RegistreProductionResponse.Ligne> mapRows(List<MouvementContrat> movements) {
        if (movements.isEmpty()) return List.of();
        List<Long> contractIds = movements.stream().map(item -> item.getContrat().getId()).distinct().toList();
        Map<Long, List<ContratClient>> clientsByContract = contratClientRepository.findByContratIdIn(contractIds)
                .stream().collect(Collectors.groupingBy(item -> item.getContrat().getId()));
        Map<Long, BigDecimal> assistanceByMovement = assistanceTotals(
                movements.stream().map(MouvementContrat::getId).toList()
        );

        return movements.stream().map(movement -> {
            Contrat contract = movement.getContrat();
            List<ContratClient> clients = clientsByContract.getOrDefault(contract.getId(), List.of());
            String subscriber = clientName(selectClient(clients, item -> item.getRole() == RoleClientContrat.SOUSCRIPTEUR));
            Client insured = selectClient(clients, item -> item.getRole() == RoleClientContrat.PROPRIETAIRE);
            return RegistreProductionResponse.Ligne.builder()
                    .mouvementId(movement.getId())
                    .contratId(contract.getId())
                    .numeroDossier(contract.getNumeroDossier())
                    .numeroPolice(contract.getNumeroPolice())
                    .numeroMouvement(movement.getNumeroMouvement())
                    .mouvementCode(movement.getTypeMouvement().getCode())
                    .mouvementLibelle(movement.getTypeMouvement().getLibelle())
                    .categorie(movement.getTypeMouvement().getCategorie())
                    .statut(movement.getStatut())
                    .typeContrat(contract.getTypeContrat())
                    .dateEffet(movement.getDateEffet())
                    .dateValidation(movement.getDateValidation())
                    .souscripteur(subscriber)
                    .assure(insured == null ? subscriber : clientName(insured))
                    .branche(contract.getBrancheAssurance() == null ? null : contract.getBrancheAssurance().getLibelle())
                    .compagnie(contract.getCompagnieAssurance() == null ? null : contract.getCompagnieAssurance().getNom())
                    .primeNette(money(movement.getPrimeNette()))
                    .taxesEtFrais(taxesAndFees(movement))
                    .primeTotale(money(movement.getPrimeTotale()))
                    .assistanceTtc(assistanceByMovement.getOrDefault(movement.getId(), BigDecimal.ZERO))
                    .build();
        }).toList();
    }

    private Map<Long, BigDecimal> assistanceTotals(Collection<Long> movementIds) {
        Map<Long, BigDecimal> result = new HashMap<>();
        for (Object[] row : assistanceContratRepository.sumTtcByMouvementIds(movementIds)) {
            result.put(((Number) row[0]).longValue(), (BigDecimal) row[1]);
        }
        return result;
    }

    private Client selectClient(List<ContratClient> links, Predicate<ContratClient> role) {
        return links.stream().filter(role)
                .sorted(Comparator.comparing(item -> !Boolean.TRUE.equals(item.getPrincipalPourRole())))
                .map(ContratClient::getClient).findFirst().orElse(null);
    }

    private RegistreProductionResponse.Totaux toTotals(
            MouvementContratRepository.RegistreProductionTotals values,
            BigDecimal assistanceTtc
    ) {
        return RegistreProductionResponse.Totaux.builder()
                .mouvements(value(values.getMouvements()))
                .annules(value(values.getAnnules()))
                .affairesNouvelles(value(values.getAffairesNouvelles()))
                .avenants(value(values.getAvenants()))
                .renouvellements(value(values.getRenouvellements()))
                .primeNette(money(values.getPrimeNette()))
                .taxesEtFrais(money(values.getTaxesEtFrais()))
                .primeTotale(money(values.getPrimeTotale()))
                .assistanceTtc(money(assistanceTtc))
                .build();
    }

    private void validate(RegistreProductionFilter filter) {
        if (filter.getDateDu() == null || filter.getDateAu() == null) {
            throw new BadRequestException("La période du registre est obligatoire");
        }
        if (filter.getDateDu().isAfter(filter.getDateAu())) {
            throw new BadRequestException("La date de début doit précéder la date de fin");
        }
        String typeDate = filter.getTypeDate() == null ? "EFFET" : filter.getTypeDate().toUpperCase();
        if (!"EFFET".equals(typeDate) && !"VALIDATION".equals(typeDate)) {
            throw new BadRequestException("Critère de date invalide");
        }
        filter.setTypeDate(typeDate);
        if (filter.getStatut() != null && !REGISTER_STATUSES.contains(filter.getStatut())) {
            throw new BadRequestException("Le registre contient uniquement les mouvements validés ou annulés");
        }
    }

    private String sortProperty(RegistreProductionFilter filter) {
        return switch (filter.getSortBy() == null ? "DATE" : filter.getSortBy().toUpperCase()) {
            case "DATE_EFFET" -> "dateEffet";
            case "DATE_VALIDATION" -> "dateValidation";
            case "DOSSIER" -> "contrat.numeroDossier";
            case "POLICE" -> "contrat.numeroPolice";
            case "MOUVEMENT" -> "numeroMouvement";
            case "COMPAGNIE" -> "contrat.compagnieAssurance.nom";
            case "PRIME_NETTE" -> "primeNette";
            case "TTC" -> "primeTotale";
            default -> "VALIDATION".equals(filter.getTypeDate()) ? "dateValidation" : "dateEffet";
        };
    }

    private byte[] createWorkbook(List<RegistreProductionResponse.Ligne> rows) {
        String[] headers = {"Validation", "Effet", "Dossier", "Police", "Mouvement N°", "Nature",
                "Catégorie", "Contrat", "Souscripteur", "Assuré", "Branche", "Compagnie",
                "Prime nette", "Taxes et frais", "TTC assurance", "TTC assistance", "Statut"};
        try (Workbook workbook = new XSSFWorkbook(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("Registre de production");
            CellStyle headerStyle = headerStyle(workbook);
            CellStyle textStyle = textStyle(workbook);
            CellStyle moneyStyle = moneyStyle(workbook);
            Row header = sheet.createRow(0);
            for (int index = 0; index < headers.length; index++) setText(header, index, headers[index], headerStyle);
            int rowIndex = 1;
            for (RegistreProductionResponse.Ligne item : rows) {
                Row row = sheet.createRow(rowIndex++);
                int column = 0;
                setText(row, column++, formatDate(item.getDateValidation()), textStyle);
                setText(row, column++, formatDate(item.getDateEffet()), textStyle);
                setText(row, column++, item.getNumeroDossier(), textStyle);
                setText(row, column++, item.getNumeroPolice(), textStyle);
                setText(row, column++, item.getNumeroMouvement(), textStyle);
                setText(row, column++, item.getMouvementLibelle(), textStyle);
                setText(row, column++, label(item.getCategorie()), textStyle);
                setText(row, column++, label(item.getTypeContrat()), textStyle);
                setText(row, column++, item.getSouscripteur(), textStyle);
                setText(row, column++, item.getAssure(), textStyle);
                setText(row, column++, item.getBranche(), textStyle);
                setText(row, column++, item.getCompagnie(), textStyle);
                setMoney(row, column++, item.getPrimeNette(), moneyStyle);
                setMoney(row, column++, item.getTaxesEtFrais(), moneyStyle);
                setMoney(row, column++, item.getPrimeTotale(), moneyStyle);
                setMoney(row, column++, item.getAssistanceTtc(), moneyStyle);
                setText(row, column, label(item.getStatut()), textStyle);
            }
            int[] widths = {14, 14, 18, 20, 15, 28, 20, 15, 26, 26, 20, 22, 16, 16, 16, 16, 13};
            for (int index = 0; index < widths.length; index++) sheet.setColumnWidth(index, widths[index] * 256);
            sheet.createFreezePane(0, 1);
            sheet.setAutoFilter(new CellRangeAddress(0, Math.max(0, sheet.getLastRowNum()), 0, headers.length - 1));
            workbook.write(output);
            return output.toByteArray();
        } catch (IOException exception) {
            throw new BadRequestException("Génération du registre Excel impossible");
        }
    }

    private CellStyle headerStyle(Workbook workbook) {
        CellStyle style = textStyle(workbook);
        style.setFillForegroundColor(IndexedColors.DARK_GREEN.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setAlignment(HorizontalAlignment.CENTER);
        Font font = workbook.createFont();
        font.setBold(true);
        font.setColor(IndexedColors.WHITE.getIndex());
        style.setFont(font);
        return style;
    }

    private CellStyle textStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        style.setWrapText(true);
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        return style;
    }

    private CellStyle moneyStyle(Workbook workbook) {
        CellStyle style = textStyle(workbook);
        style.setDataFormat(workbook.createDataFormat().getFormat("#,##0.00"));
        return style;
    }

    private void setText(Row row, int column, String value, CellStyle style) {
        Cell cell = row.createCell(column);
        cell.setCellValue(value == null ? "" : value);
        cell.setCellStyle(style);
    }

    private void setMoney(Row row, int column, BigDecimal value, CellStyle style) {
        Cell cell = row.createCell(column);
        cell.setCellValue(money(value).doubleValue());
        cell.setCellStyle(style);
    }

    private BigDecimal taxesAndFees(MouvementContrat movement) {
        return money(movement.getTaxe()).add(money(movement.getTaxeParafiscale()))
                .add(money(movement.getAccessoire())).add(money(movement.getCnpac()));
    }

    private long value(Long value) {
        return value == null ? 0L : value;
    }

    private BigDecimal money(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private String normalizedSearch(String search) {
        return search == null ? null : search.trim();
    }

    private String clientName(Client client) {
        return client == null || client.getNomAffichage() == null || client.getNomAffichage().isBlank()
                ? null : client.getNomAffichage();
    }

    private String formatDate(java.time.LocalDate date) {
        return date == null ? "" : DATE_FORMAT.format(date);
    }

    private String label(Enum<?> value) {
        return value == null ? "" : value.name().replace('_', ' ');
    }
}
