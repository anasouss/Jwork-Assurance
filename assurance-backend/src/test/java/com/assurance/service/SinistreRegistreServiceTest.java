package com.assurance.service;

import com.assurance.dto.response.SinistreSummaryResponse;
import com.assurance.enums.EtapeSuiviSinistre;
import com.assurance.enums.ModeReparationSinistre;
import com.assurance.enums.NatureSinistre;
import com.assurance.enums.StatutSinistre;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SinistreRegistreServiceTest {

    private final SinistreService claims = mock(SinistreService.class);
    private final SinistreRegistreService service = new SinistreRegistreService(claims);

    @Test
    void exportPassesAgencyAndAllSearchFiltersWithoutPagination() {
        LocalDate start = LocalDate.of(2026, 1, 1);
        LocalDate end = LocalDate.of(2026, 6, 30);
        when(claims.registre(7L, "123-A", 2L, 3L, 4L, StatutSinistre.DECLARE,
                NatureSinistre.ACCIDENT, EtapeSuiviSinistre.INSTANCE_CLIENT, start, end)).thenReturn(List.of());

        assertThat(service.export(7L, "123-A", 2L, 3L, 4L, StatutSinistre.DECLARE,
                NatureSinistre.ACCIDENT, EtapeSuiviSinistre.INSTANCE_CLIENT, start, end)).isNotEmpty();

        verify(claims).registre(7L, "123-A", 2L, 3L, 4L, StatutSinistre.DECLARE,
                NatureSinistre.ACCIDENT, EtapeSuiviSinistre.INSTANCE_CLIENT, start, end);
    }

    @Test
    void workbookPreservesReferencesAsTextAndAmountsAndDatesAsTypedCells() throws Exception {
        var claim = SinistreSummaryResponse.builder()
                .numeroSinistre("SIN-26-0001")
                .referenceCompagnie("=1+1")
                .assure("Client test")
                .numeroPolice("00001234")
                .dateSinistre(LocalDate.of(2026, 2, 25))
                .dateDeclaration(LocalDate.of(2026, 2, 26))
                .modeReparation(ModeReparationSinistre.PEC)
                .etapeSuivi(EtapeSuiviSinistre.EXPERTISE_APRES)
                .statut(StatutSinistre.DECLARE)
                .provisionCourante(new BigDecimal("1234.50"))
                .totalRegle(BigDecimal.ZERO)
                .totalRecours(BigDecimal.ZERO)
                .build();

        try (var workbook = new XSSFWorkbook(new ByteArrayInputStream(service.workbook(List.of(claim))))) {
            var sheet = workbook.getSheetAt(0);
            var row = sheet.getRow(1);
            assertThat(row.getCell(1).getCellType()).isEqualTo(CellType.STRING);
            assertThat(row.getCell(1).getStringCellValue()).isEqualTo("=1+1");
            assertThat(row.getCell(3).getStringCellValue()).isEqualTo("00001234");
            assertThat(row.getCell(6).getLocalDateTimeCellValue().toLocalDate()).isEqualTo(claim.getDateSinistre());
            assertThat(row.getCell(9).getStringCellValue()).isEqualTo("PEC");
            assertThat(row.getCell(11).getStringCellValue()).isEqualTo("Expertise après");
            assertThat(row.getCell(13).getCellType()).isEqualTo(CellType.NUMERIC);
            assertThat(row.getCell(13).getNumericCellValue()).isEqualTo(1234.5);
            assertThat(sheet.getPaneInformation().getHorizontalSplitPosition()).isEqualTo((short) 1);
            assertThat(sheet.getRepeatingRows().getFirstRow()).isZero();
        }
    }

    @Test
    void emptyRegisterStillContainsPrintableFilterableHeaders() throws Exception {
        try (var workbook = new XSSFWorkbook(new ByteArrayInputStream(service.workbook(List.of())))) {
            var sheet = workbook.getSheetAt(0);
            assertThat(sheet.getLastRowNum()).isZero();
            assertThat(sheet.getRow(0).getCell(0).getStringCellValue()).isEqualTo("N° sinistre");
            assertThat(sheet.getRow(0).getPhysicalNumberOfCells()).isEqualTo(16);
            assertThat(sheet.getPrintSetup().getLandscape()).isTrue();
            assertThat(sheet.getPrintSetup().getFitWidth()).isEqualTo((short) 1);
        }
    }
}
