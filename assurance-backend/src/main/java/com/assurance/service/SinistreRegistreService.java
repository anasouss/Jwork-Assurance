package com.assurance.service;

import com.assurance.dto.response.SinistreSummaryResponse;
import com.assurance.enums.EtapeSuiviSinistre;
import com.assurance.enums.NatureSinistre;
import com.assurance.enums.StatutSinistre;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;

@Service
@RequiredArgsConstructor
public class SinistreRegistreService {

    private static final List<String> HEADERS = List.of(
            "N° sinistre", "Référence compagnie", "Assuré", "Police N°", "Compagnie", "Véhicule",
            "Sinistre du", "Déclaré le", "Garanties sinistrées", "Mode de réparation", "Premier expert",
            "Étape de suivi", "Statut", "Provision (MAD)", "Règlements (MAD)", "Recours (MAD)"
    );

    private final SinistreService sinistreService;

    @Transactional(readOnly = true)
    public byte[] export(
            Long agenceId,
            String query,
            Long clientId,
            Long contratId,
            Long brancheId,
            StatutSinistre statut,
            NatureSinistre nature,
            EtapeSuiviSinistre etapeSuivi,
            LocalDate dateDu,
            LocalDate dateAu
    ) {
        List<SinistreSummaryResponse> claims = sinistreService.registre(
                agenceId, query, clientId, contratId, brancheId, statut, nature, etapeSuivi, dateDu, dateAu
        );
        return workbook(claims);
    }

    byte[] workbook(List<SinistreSummaryResponse> claims) {
        try (var workbook = new XSSFWorkbook(); var output = new ByteArrayOutputStream()) {
            var sheet = workbook.createSheet("Registre des sinistres");
            var headerStyle = workbook.createCellStyle();
            headerStyle.setFillForegroundColor(IndexedColors.DARK_TEAL.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            headerStyle.setBorderBottom(BorderStyle.THIN);
            var font = workbook.createFont();
            font.setBold(true);
            font.setColor(IndexedColors.WHITE.getIndex());
            headerStyle.setFont(font);
            var moneyStyle = workbook.createCellStyle();
            moneyStyle.setDataFormat(workbook.createDataFormat().getFormat("#,##0.00"));
            var dateStyle = workbook.createCellStyle();
            dateStyle.setDataFormat(workbook.createDataFormat().getFormat("dd/mm/yyyy"));

            var header = sheet.createRow(0);
            header.setHeightInPoints(25);
            for (int column = 0; column < HEADERS.size(); column++) {
                var cell = header.createCell(column);
                cell.setCellValue(HEADERS.get(column));
                cell.setCellStyle(headerStyle);
            }
            int index = 1;
            for (SinistreSummaryResponse claim : claims) {
                List<Object> values = Arrays.asList(
                        claim.getNumeroSinistre(), claim.getReferenceCompagnie(), claim.getAssure(),
                        claim.getNumeroPolice(), claim.getCompagnie(), claim.getImmatriculation(),
                        claim.getDateSinistre(), claim.getDateDeclaration(), claim.getGarantiesImpliquees() == null
                                ? "" : String.join(", ", claim.getGarantiesImpliquees()),
                        repairLabel(claim.getModeReparation()), claim.getPremierExpert(),
                        stepLabel(claim.getEtapeSuivi()), statusLabel(claim.getStatut()),
                        claim.getProvisionCourante(), claim.getTotalRegle(), claim.getTotalRecours()
                );
                var row = sheet.createRow(index++);
                for (int column = 0; column < values.size(); column++) {
                    writeCell(row.createCell(column), values.get(column), moneyStyle, dateStyle);
                }
            }
            sheet.createFreezePane(3, 1);
            sheet.setAutoFilter(new CellRangeAddress(0, Math.max(0, claims.size()), 0, HEADERS.size() - 1));
            for (int column = 0; column < HEADERS.size(); column++) {
                sheet.setColumnWidth(column, (column == 2 || column == 8 || column == 10 ? 32 : 23) * 256);
            }
            sheet.getPrintSetup().setLandscape(true);
            sheet.getPrintSetup().setFitWidth((short) 1);
            sheet.getPrintSetup().setFitHeight((short) 0);
            sheet.setFitToPage(true);
            sheet.setRepeatingRows(new CellRangeAddress(0, 0, -1, -1));
            workbook.write(output);
            return output.toByteArray();
        } catch (IOException exception) {
            throw new IllegalStateException("Export du registre des sinistres impossible", exception);
        }
    }

    private void writeCell(org.apache.poi.ss.usermodel.Cell cell, Object value, CellStyle moneyStyle, CellStyle dateStyle) {
        if (value instanceof BigDecimal amount) {
            cell.setCellValue(amount.doubleValue());
            cell.setCellStyle(moneyStyle);
        } else if (value instanceof LocalDate date) {
            cell.setCellValue(date);
            cell.setCellStyle(dateStyle);
        } else {
            // Explicit string cells keep user-supplied references from becoming Excel formulas.
            cell.setCellValue(value == null ? "" : value.toString());
        }
    }

    private String repairLabel(com.assurance.enums.ModeReparationSinistre mode) {
        if (mode == null) return "";
        return switch (mode) {
            case NORMAL -> "Normal";
            case PEC -> "PEC";
            case RAPIDE -> "Rapide";
        };
    }

    private String stepLabel(EtapeSuiviSinistre step) {
        if (step == null) return "";
        return switch (step) {
            case OUVERTURE -> "Ouverture";
            case EXPERTISE_AVANT -> "Expertise avant";
            case INSTANCE_CLIENT -> "Instance client";
            case EXPERTISE_APRES -> "Expertise après";
            case COMPAGNIE -> "Compagnie";
            case CLOTURE -> "Clôturé";
        };
    }

    private String statusLabel(StatutSinistre status) {
        if (status == null) return "";
        return switch (status) {
            case BROUILLON -> "Brouillon";
            case DECLARE -> "Déclaré";
            case DOSSIER_INCOMPLET -> "Dossier incomplet";
            case TRANSMIS_COMPAGNIE -> "Transmis à la compagnie";
            case EXPERTISE -> "Expertise";
            case EN_ATTENTE_REGLEMENT -> "En attente de règlement";
            case PARTIELLEMENT_REGLE -> "Partiellement réglé";
            case REGLE -> "Réglé";
            case CLOTURE -> "Clôturé";
            case REJETE -> "Rejeté";
            case ANNULE -> "Annulé";
            case ROUVERT -> "Rouvert";
        };
    }
}
