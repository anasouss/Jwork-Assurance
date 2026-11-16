package com.assurance.service;

import com.assurance.controller.PrestataireSinistreController;
import com.assurance.dto.response.PageMetadata;
import com.assurance.dto.response.PagedResponse;
import com.assurance.dto.response.SinistreIntervenantResponse;
import com.assurance.dto.response.SpecialitePrestataireResponse;
import com.assurance.entity.BrancheAssurance;
import com.assurance.entity.DomaineInterventionSinistre;
import com.assurance.enums.TypePrestataireSinistre;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.security.PermissionDependencies;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.prepost.PreAuthorize;

import java.io.ByteArrayInputStream;
import java.util.List;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class PrestataireDirectoryExportServiceTest {
    private final SinistreIntervenantService directory = mock(SinistreIntervenantService.class);
    private final DomaineInterventionSinistreService domains = mock(DomaineInterventionSinistreService.class);
    private final PrestataireDirectoryExportService service = new PrestataireDirectoryExportService(directory, domains);

    @Test
    void automobileExportsEveryPageWithAppliedFiltersAndSafeTextCells() throws Exception {
        when(domains.require(7L, 10L)).thenReturn(DomaineInterventionSinistre.builder()
                .brancheAssurance(BrancheAssurance.builder().code("AUTOMOBILE").build()).build());
        var first = IntStream.range(0, 100).mapToObj(index -> item(TypePrestataireSinistre.EXPERT, index == 0 ? "=1+1" : "Expert " + index)).toList();
        when(directory.directoryAll(7L, true, "cabinet", 8L, 9L, null, null, 10L, 0, 100))
                .thenReturn(page(first, 2, 101));
        when(directory.directoryAll(7L, true, "cabinet", 8L, 9L, null, null, 10L, 1, 100))
                .thenReturn(page(List.of(item(TypePrestataireSinistre.EXPERT, "Dernière page")), 2, 101));
        var filters = new PrestataireDirectoryExportService.Filters(TypePrestataireSinistre.GARAGE, true, true, "cabinet", 8L, 9L, null, null, 10L);
        try (var workbook = new XSSFWorkbook(new ByteArrayInputStream(service.export(7L, filters)))) {
            var sheet = workbook.getSheetAt(0);
            assertThat(sheet.getRow(0).getLastCellNum()).isEqualTo((short) 8);
            assertThat(sheet.getRow(0).getCell(0).getStringCellValue()).isEqualTo("Opérateur");
            assertThat(sheet.getRow(0).getCell(7).getStringCellValue()).isEqualTo("Statut");
            assertThat(sheet.getLastRowNum()).isEqualTo(101);
            assertThat(sheet.getRow(101).getCell(2).getStringCellValue()).isEqualTo("Dernière page");
            assertThat(sheet.getRow(1).getCell(2).getCellType()).isEqualTo(CellType.STRING);
            assertThat(sheet.getRow(1).getCell(2).getStringCellValue()).isEqualTo("=1+1");
            assertThat(sheet.getRow(1).getCell(3).getStringCellValue()).isEqualTo("0528000000");
        }
        verify(directory, times(2)).directoryAll(eq(7L), eq(true), eq("cabinet"), eq(8L), eq(9L), isNull(), isNull(), eq(10L), anyInt(), eq(100));
    }

    @Test
    void physicianExportUsesPhysicianColumnsAndSelectedSpecialty() throws Exception {
        var physician = item(TypePrestataireSinistre.MEDECIN, "Médecin");
        physician.setActif(false);
        physician.setSpecialites(List.of(new SpecialitePrestataireResponse(12L, "MED", "Spécialité médicale",
                TypePrestataireSinistre.MEDECIN, true, List.of(), List.of(), List.of())));
        when(directory.directory(7L, TypePrestataireSinistre.MEDECIN, true, null, null, null, 12L, null, null, 0, 100))
                .thenReturn(page(List.of(physician), 1, 1));
        var filters = new PrestataireDirectoryExportService.Filters(TypePrestataireSinistre.MEDECIN, false, true, null, null, null, 12L, null, null);
        try (var workbook = new XSSFWorkbook(new ByteArrayInputStream(service.export(7L, filters)))) {
            var sheet = workbook.getSheetAt(0);
            assertThat(sheet.getRow(0).getLastCellNum()).isEqualTo((short) 5);
            assertThat(sheet.getRow(0).getCell(0).getStringCellValue()).isEqualTo("Médecin");
            assertThat(sheet.getRow(1).getCell(0).getStringCellValue()).isEqualTo("Médecin (Inactif)");
            assertThat(sheet.getRow(1).getCell(4).getStringCellValue()).isEqualTo("Spécialité médicale");
        }
    }

    @Test
    void generalExportKeepsTheGeneralTableLayout() throws Exception {
        var expert = item(TypePrestataireSinistre.EXPERT, "Expert");
        expert.setDomaines(List.of(new SpecialitePrestataireResponse.Reference(10L, "Automobile")));
        when(directory.directory(7L, TypePrestataireSinistre.EXPERT, false, null, null, null, null, null, null, 0, 100))
                .thenReturn(page(List.of(expert), 1, 1));
        var filters = new PrestataireDirectoryExportService.Filters(TypePrestataireSinistre.EXPERT, false, false, null, null, null, null, null, null);
        try (var workbook = new XSSFWorkbook(new ByteArrayInputStream(service.export(7L, filters)))) {
            var sheet = workbook.getSheetAt(0);
            assertThat(sheet.getRow(0).getCell(0).getStringCellValue()).isEqualTo("Opérateur");
            assertThat(sheet.getRow(0).getCell(1).getStringCellValue()).isEqualTo("Branche");
            assertThat(sheet.getRow(0).getCell(6).getStringCellValue()).isEqualTo("Ville");
            assertThat(sheet.getRow(0).getLastCellNum()).isEqualTo((short) 8);
            assertThat(sheet.getRow(1).getCell(0).getStringCellValue()).isEqualTo("Expert");
            assertThat(sheet.getRow(1).getCell(1).getStringCellValue()).isEqualTo("Automobile");
            assertThat(sheet.getRow(1).getCell(2).getStringCellValue()).isEqualTo("Expert");
            assertThat(sheet.getRow(1).getCell(3).getStringCellValue()).isEqualTo("0528000000");
            assertThat(sheet.getRow(1).getCell(4).getStringCellValue()).isEqualTo("contact@example.test");
            assertThat(sheet.getRow(1).getCell(5).getStringCellValue()).isEqualTo("Adresse");
            assertThat(sheet.getRow(1).getCell(7).getStringCellValue()).isEqualTo("Actif");
        }
    }

    @Test
    void anotherAgencysDomainCannotBeUsedForExport() {
        when(domains.require(7L, 10L)).thenThrow(new ResourceNotFoundException("Domaine", 10L));
        var filters = new PrestataireDirectoryExportService.Filters(TypePrestataireSinistre.GARAGE, true, false, null, null, null, null, null, 10L);
        assertThatThrownBy(() -> service.export(7L, filters)).isInstanceOf(ResourceNotFoundException.class);
        verifyNoInteractions(directory);
    }

    @Test
    void exportRequiresItsDedicatedPermissionAndConsultation() {
        var method = java.util.Arrays.stream(PrestataireSinistreController.class.getDeclaredMethods())
                .filter(candidate -> candidate.getName().equals("export")).findFirst().orElseThrow();
        assertThat(method.getAnnotation(PreAuthorize.class).value())
                .contains("PERM_prestataire-sinistre:export", "PERM_prestataire-sinistre:view");
        assertThat(PermissionDependencies.requiredFor("prestataire-sinistre:export")).contains("prestataire-sinistre:view");
    }

    private SinistreIntervenantResponse item(TypePrestataireSinistre type, String name) {
        return SinistreIntervenantResponse.builder().id(1L).code("P001").nom(name).typePrestataire(type).actif(true)
                .telephone("0528000000").email("contact@example.test").ville("Agadir").adresse("Adresse")
                .specialites(List.of()).domaines(List.of()).accords(List.of()).toutesCompagnies(true).build();
    }

    private PagedResponse<SinistreIntervenantResponse> page(List<SinistreIntervenantResponse> items, int pages, long total) {
        return PagedResponse.<SinistreIntervenantResponse>builder().items(items)
                .page(PageMetadata.builder().totalPages(pages).totalElements(total).build()).build();
    }
}
