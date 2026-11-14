package com.assurance.service;

import com.assurance.entity.Contrat;
import com.assurance.enums.TypeContrat;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.ContratRepository;
import com.assurance.repository.VehiculeRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class FleetExcelPermissionTest {
    private final VehiculeImportService service = mock(VehiculeImportService.class, CALLS_REAL_METHODS);
    private final ContratRepository contrats = mock(ContratRepository.class);

    @BeforeEach
    void setup() {
        ReflectionTestUtils.setField(service, "contratRepository", contrats);
    }

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void guaranteeImportUsesAgencySettingAndDefaultsToDisabled() {
        ParametreApplicationService parameters = mock(ParametreApplicationService.class);
        ReflectionTestUtils.setField(service, "parametreApplicationService", parameters);
        when(parameters.getBoolean(1L, "ENABLE_FLEET_EXCEL_GUARANTEE_IMPORT", false)).thenReturn(true);
        assertThat((Boolean) ReflectionTestUtils.invokeMethod(service, "isGuaranteeImportEnabled", 1L)).isTrue();
        assertThat((Boolean) ReflectionTestUtils.invokeMethod(service, "isGuaranteeImportEnabled", 2L)).isFalse();
    }

    @Test
    void editingWithoutDedicatedImportCannotDownloadTemplateOrPreview() {
        authenticate("contrat:view", "contrat:create");
        assertThatThrownBy(() -> service.template(1L, 9L)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> service.preview(1L, 9L, null)).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(contrats);
    }

    @Test
    void importRequiresTheWorkflowOfTheStoredDraft() {
        Contrat draft = Contrat.builder().typeContrat(TypeContrat.FLOTTE).brouillon(true).build();
        when(contrats.findByAgenceIdAndId(1L, 9L)).thenReturn(Optional.of(draft));
        authenticate("contrat:view", "contrat:import");
        assertThatThrownBy(this::authorizeDraft).isInstanceOf(AccessDeniedException.class);
        authenticate("contrat:view", "contrat:import", "contrat:create");
        assertThatCode(this::authorizeDraft).doesNotThrowAnyException();
        draft.setContratOrigine(new Contrat());
        assertThatThrownBy(this::authorizeDraft).isInstanceOf(AccessDeniedException.class);
        authenticate("contrat:view", "contrat:import", "contrat:renew");
        assertThatCode(this::authorizeDraft).doesNotThrowAnyException();
        draft.setContratOrigine(null);
        assertThatThrownBy(this::authorizeDraft).isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void exportDoesNotRequireImportOrEditing() {
        authenticate("contrat:view", "contrat:export");
        when(contrats.findByAgenceIdAndId(1L, 9L)).thenReturn(Optional.of(
                Contrat.builder().typeContrat(TypeContrat.FLOTTE).brouillon(false).build()));
        VehiculeRepository vehicles = mock(VehiculeRepository.class);
        ReflectionTestUtils.setField(service, "vehiculeRepository", vehicles);
        when(vehicles.findForExportByContratIdOrderByCreatedAtAsc(9L)).thenReturn(List.of());
        assertThatThrownBy(() -> service.exportSubmittedVehicles(1L, 9L))
                .isInstanceOf(BadRequestException.class).hasMessage("Aucun véhicule enregistré à exporter");
    }

    @Test
    void exportRequiresBothReadAndDedicatedExportAndRespectsAgency() {
        authenticate("contrat:view");
        assertThatThrownBy(() -> service.exportSubmittedVehicles(1L, 9L)).isInstanceOf(AccessDeniedException.class);
        authenticate("contrat:export");
        assertThatThrownBy(() -> service.exportSubmittedVehicles(1L, 9L)).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(contrats);
        authenticate("contrat:view", "contrat:export");
        when(contrats.findByAgenceIdAndId(1L, 9L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.exportSubmittedVehicles(1L, 9L)).isInstanceOf(ResourceNotFoundException.class);
    }

    private void authorizeDraft() {
        ReflectionTestUtils.invokeMethod(service, "requireFleetDraft", 1L, 9L);
    }

    private void authenticate(String... codes) {
        String[] authorities = Arrays.stream(codes).map(code -> "PERM_" + code).toArray(String[]::new);
        SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken("actor", "unused", authorities));
    }
}
