package com.assurance.service;

import com.assurance.dto.response.InstrumentReglementPageResponse;
import com.assurance.dto.response.ReglementClientResponse;
import com.assurance.enums.ModeReglementClient;
import com.assurance.enums.ResolutionRejetBancaire;
import com.assurance.enums.StatutSuiviRejetBancaire;
import com.assurance.exception.BadRequestException;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDate;

@Service
@RequiredArgsConstructor
public class RejetBancaireExportService {

    private final ReglementClientService reglementClientService;

    @Transactional(readOnly = true)
    public byte[] export(Long agenceId, ModeReglementClient mode, Long banqueId,
                         LocalDate dateDu, LocalDate dateAu, String payeurType, Long payeurId,
                         ResolutionRejetBancaire resolution, String search, String sortBy, String sortDirection) {
        try (Workbook workbook = new XSSFWorkbook(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("Rejets bancaires");
            String[] headers = {"Mode", "Référence", "Payeur", "Montant (MAD)", "Date du règlement",
                    "Date de retour", "Motif du retour", "Statut"};
            CellStyle headerStyle = workbook.createCellStyle();
            headerStyle.setFillForegroundColor(IndexedColors.ORANGE.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerFont.setColor(IndexedColors.WHITE.getIndex());
            headerStyle.setFont(headerFont);
            CellStyle moneyStyle = workbook.createCellStyle();
            moneyStyle.setDataFormat(workbook.createDataFormat().getFormat("#,##0.00"));
            CellStyle dateStyle = workbook.createCellStyle();
            dateStyle.setDataFormat(workbook.createDataFormat().getFormat("dd/mm/yyyy"));
            Row header = sheet.createRow(0);
            header.setHeightInPoints(24);
            for (int column = 0; column < headers.length; column++) {
                Cell cell = header.createCell(column);
                cell.setCellValue(headers[column]);
                cell.setCellStyle(headerStyle);
            }

            int page = 0;
            int rowIndex = 1;
            InstrumentReglementPageResponse result;
            do {
                result = reglementClientService.searchBankRejections(agenceId, mode, banqueId,
                        dateDu, dateAu, payeurType, payeurId, resolution, search, sortBy, sortDirection, page++, 100);
                for (ReglementClientResponse.Instrument item : result.getRows()) {
                    if (rowIndex >= 1_048_576) {
                        throw new BadRequestException("Trop de résultats pour Excel. Précisez les filtres.");
                    }
                    Row row = sheet.createRow(rowIndex++);
                    text(row, 0, item.getMode() == ModeReglementClient.CHEQUE ? "Chèque" : "Effet");
                    text(row, 1, item.getReferenceInstrument());
                    text(row, 2, item.getPayeurNom());
                    Cell amount = row.createCell(3);
                    if (item.getMontant() != null) amount.setCellValue(item.getMontant().doubleValue());
                    amount.setCellStyle(moneyStyle);
                    date(row, 4, item.getDateReglement(), dateStyle);
                    date(row, 5, item.getDateRejet(), dateStyle);
                    text(row, 6, item.getMotifRejet());
                    text(row, 7, statusLabel(item.getStatutSuiviRejet()));
                }
            } while (page < result.getPage().getTotalPages());

            int[] widths = {14, 23, 34, 20, 23, 20, 48, 20};
            for (int column = 0; column < widths.length; column++) {
                sheet.setColumnWidth(column, widths[column] * 256);
            }
            sheet.createFreezePane(0, 1);
            sheet.setAutoFilter(new CellRangeAddress(0, Math.max(0, sheet.getLastRowNum()), 0, headers.length - 1));
            workbook.write(output);
            return output.toByteArray();
        } catch (IOException exception) {
            throw new BadRequestException("Génération du fichier Excel impossible");
        }
    }

    private void text(Row row, int column, String value) {
        row.createCell(column).setCellValue(value == null ? "" : value);
    }

    private void date(Row row, int column, LocalDate value, CellStyle style) {
        Cell cell = row.createCell(column);
        if (value != null) cell.setCellValue(value.atStartOfDay());
        cell.setCellStyle(style);
    }

    private String statusLabel(StatutSuiviRejetBancaire status) {
        if (status == null) return "";
        return switch (status) {
            case INSTANCE -> "En instance";
            case REPRESENTE -> "Représenté";
            case REGLE_CV -> "Réglé C/V";
            case CONTENTIEUX -> "Contentieux";
        };
    }
}
