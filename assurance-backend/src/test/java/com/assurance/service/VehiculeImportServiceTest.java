package com.assurance.service;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class VehiculeImportServiceTest {

    @Test
    void readsNumericAmountWithoutDependingOnFrenchDisplayFormatting() throws Exception {
        try (Workbook workbook = new XSSFWorkbook()) {
            Row row = workbook.createSheet().createRow(0);
            Cell cell = row.createCell(0);
            CellStyle style = workbook.createCellStyle();
            style.setDataFormat(workbook.createDataFormat().getFormat("#,##0.00"));
            cell.setCellStyle(style);
            cell.setCellValue(5000d);

            assertThat(VehiculeImportService.parseDecimalCell(cell))
                    .isEqualByComparingTo("5000");
        }
    }

    @Test
    void acceptsCommonFrenchAndInternationalTextFormats() {
        assertThat(VehiculeImportService.parseDecimalText("5000,00"))
                .isEqualByComparingTo("5000.00");
        assertThat(VehiculeImportService.parseDecimalText("5 000,00"))
                .isEqualByComparingTo("5000.00");
        assertThat(VehiculeImportService.parseDecimalText("5\u00a0000,00"))
                .isEqualByComparingTo("5000.00");
        assertThat(VehiculeImportService.parseDecimalText("5\u202f000,00"))
                .isEqualByComparingTo("5000.00");
        assertThat(VehiculeImportService.parseDecimalText("5.000,00"))
                .isEqualByComparingTo("5000.00");
        assertThat(VehiculeImportService.parseDecimalText("5,000.00"))
                .isEqualByComparingTo("5000.00");
    }

    @Test
    void rejectsNonNumericText() {
        assertThatThrownBy(() -> VehiculeImportService.parseDecimalText("cinq mille"))
                .isInstanceOf(NumberFormatException.class);
    }
}
