package com.assurance.service;

import com.assurance.dto.response.SourceDocumentClientPageResponse;
import com.assurance.dto.response.SourceDocumentClientResponse;
import com.assurance.enums.TypeContrat;
import com.assurance.enums.TypeDocumentClient;
import com.assurance.exception.BadRequestException;
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
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DocumentClientExportService {

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final int EXPORT_PAGE_SIZE = 100;

    private final DocumentClientService documentClientService;

    @Transactional(readOnly = true)
    public byte[] exportSources(
            Long agenceId,
            String payeurType,
            Long payeurId,
            Long brancheId,
            Long compagnieId,
            TypeContrat typeContrat,
            String documentState,
            LocalDate dateDu,
            LocalDate dateAu,
            String search,
            String sortBy,
            String sortDirection
    ) {
        String sortProperty = "primeTotale".equals(sortBy) ? "primeTotale" : "dateDebut";
        Sort.Direction direction = "asc".equalsIgnoreCase(sortDirection)
                ? Sort.Direction.ASC : Sort.Direction.DESC;
        Sort sort = Sort.by(direction, sortProperty).and(Sort.by(Sort.Direction.DESC, "id"));
        List<SourceDocumentClientResponse> rows = new ArrayList<>();
        int page = 0;
        SourceDocumentClientPageResponse result;
        do {
            result = documentClientService.searchSources(
                    agenceId,
                    payeurType,
                    payeurId,
                    null,
                    brancheId,
                    compagnieId,
                    typeContrat,
                    documentState,
                    dateDu,
                    dateAu,
                    search,
                    true,
                    false,
                    sort,
                    page,
                    EXPORT_PAGE_SIZE
            );
            rows.addAll(result.getRows());
            page++;
        } while (page < result.getPage().getTotalPages());

        return createWorkbook(rows);
    }

    private byte[] createWorkbook(List<SourceDocumentClientResponse> rows) {
        String[] headers = {
                "Souscripteur", "Assuré", "Payeur", "Police / référence", "Dossier", "Nature",
                "Mouvement", "Compagnie", "Type contrat", "Date effet", "Date échéance",
                "Prime nette", "Taxes et frais", "TTC", "FC/RL", "Référence document"
        };

        try (Workbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("Relevés et factures");
            CellStyle headerStyle = headerStyle(workbook);
            CellStyle textStyle = textStyle(workbook);
            CellStyle moneyStyle = moneyStyle(workbook);

            Row header = sheet.createRow(0);
            header.setHeightInPoints(24);
            for (int column = 0; column < headers.length; column++) {
                setText(header, column, headers[column], headerStyle);
            }

            int rowIndex = 1;
            for (SourceDocumentClientResponse item : rows) {
                Row row = sheet.createRow(rowIndex++);
                row.setHeightInPoints(30);
                writeRow(row, item, textStyle, moneyStyle);
            }

            int[] widths = {26, 26, 26, 22, 18, 20, 28, 24, 16, 15, 15, 17, 17, 17, 12, 30};
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

    private void writeRow(
            Row row,
            SourceDocumentClientResponse item,
            CellStyle textStyle,
            CellStyle moneyStyle
    ) {
        int column = 0;
        setText(row, column++, item.getSouscripteurNom(), textStyle);
        setText(row, column++, item.getAssureNom(), textStyle);
        setText(row, column++, item.getPayeurNom(), textStyle);
        setText(row, column++, firstNonBlank(item.getPolice(), item.getReference()), textStyle);
        setText(row, column++, item.getDossier(), textStyle);
        setText(row, column++, enumLabel(item.getNature()), textStyle);
        setText(row, column++, item.getMouvement(), textStyle);
        setText(row, column++, item.getCompagnie(), textStyle);
        setText(row, column++, enumLabel(item.getTypeContrat()), textStyle);
        setText(row, column++, formatDate(item.getDateEffet()), textStyle);
        setText(row, column++, formatDate(item.getDateEcheance()), textStyle);
        setMoney(row, column++, item.getPrimeNette(), moneyStyle);
        setMoney(row, column++, money(item.getTaxes()).add(money(item.getAccessoires())), moneyStyle);
        setMoney(row, column++, item.getMontantTtc(), moneyStyle);
        setText(row, column++, documentTypes(item.getDocuments()), textStyle);
        setText(row, column, documentReferences(item.getDocuments()), textStyle);
    }

    private String documentTypes(List<SourceDocumentClientResponse.DocumentReference> documents) {
        if (documents == null) return "";
        return documents.stream()
                .map(SourceDocumentClientResponse.DocumentReference::getType)
                .filter(Objects::nonNull)
                .map(type -> type == TypeDocumentClient.FACTURE ? "FC" : "RL")
                .distinct()
                .collect(Collectors.joining(", "));
    }

    private String documentReferences(List<SourceDocumentClientResponse.DocumentReference> documents) {
        if (documents == null) return "";
        return documents.stream()
                .map(document -> firstNonBlank(document.getNumero(), "-")
                        + (document.getDateEmission() == null ? "" : " - " + formatDate(document.getDateEmission())))
                .collect(Collectors.joining("\n"));
    }

    private CellStyle headerStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        style.setFillForegroundColor(IndexedColors.DARK_GREEN.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setAlignment(HorizontalAlignment.CENTER);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        applyBorders(style);
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
        applyBorders(style);
        return style;
    }

    private CellStyle moneyStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        style.setDataFormat(workbook.createDataFormat().getFormat("#,##0.00 \"MAD\""));
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        applyBorders(style);
        return style;
    }

    private void applyBorders(CellStyle style) {
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setTopBorderColor(IndexedColors.GREY_25_PERCENT.getIndex());
        style.setRightBorderColor(IndexedColors.GREY_25_PERCENT.getIndex());
        style.setBottomBorderColor(IndexedColors.GREY_25_PERCENT.getIndex());
        style.setLeftBorderColor(IndexedColors.GREY_25_PERCENT.getIndex());
    }

    private void setText(Row row, int column, String value, CellStyle style) {
        Cell cell = row.createCell(column);
        cell.setCellValue(value == null ? "" : value);
        cell.setCellStyle(style);
    }

    private void setMoney(Row row, int column, BigDecimal value, CellStyle style) {
        Cell cell = row.createCell(column);
        if (value != null) cell.setCellValue(value.doubleValue());
        cell.setCellStyle(style);
    }

    private BigDecimal money(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private String formatDate(LocalDate value) {
        return value == null ? "" : DATE_FORMAT.format(value);
    }

    private String enumLabel(Enum<?> value) {
        return value == null ? "" : value.name().replace('_', ' ');
    }

    private String firstNonBlank(String first, String fallback) {
        return first == null || first.isBlank() ? fallback : first;
    }
}
