package com.assurance.service;

import com.assurance.dto.request.BulkUpdateTarifUsageRequest;
import com.assurance.entity.AjustementTarifUsage;
import com.assurance.entity.LigneAjustementTarifUsage;
import com.assurance.entity.TarifUsage;
import com.assurance.enums.SensAjustementTarifUsage;
import com.assurance.enums.TypeCalculAjustementTarifUsage;
import com.assurance.enums.TypeOperationTarifUsage;
import com.assurance.repository.AjustementTarifUsageRepository;
import com.assurance.repository.LigneAjustementTarifUsageRepository;
import com.assurance.repository.TarifUsageRepository;
import com.assurance.repository.UtilisateurRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TarifUsageAjustementServiceTest {

    @Mock
    private TarifUsageRepository tarifUsageRepository;

    @Mock
    private AjustementTarifUsageRepository ajustementRepository;

    @Mock
    private LigneAjustementTarifUsageRepository ligneRepository;

    @Mock
    private UtilisateurRepository utilisateurRepository;

    @InjectMocks
    private TarifUsageAjustementService service;

    @Test
    void consecutiveAdjustmentsAlwaysUseInitialPremium() {
        TarifUsage tarif = tariff("100.00");
        when(tarifUsageRepository.findAll()).thenReturn(List.of(tarif));
        when(ajustementRepository.save(any(AjustementTarifUsage.class))).thenAnswer(invocation -> invocation.getArgument(0));
        ArgumentCaptor<List<LigneAjustementTarifUsage>> lines = lineCaptor();

        service.apply(adjustment("10"));
        service.apply(adjustment("20"));

        assertThat(lines.getAllValues().get(0).get(0).getPrimeNetteAppliquee()).isEqualByComparingTo("110.00");
        assertThat(lines.getAllValues().get(1).get(0).getPrimeNetteAppliquee()).isEqualByComparingTo("120.00");
        assertThat(tarif.getPrimeNette()).isEqualByComparingTo("100.00");
    }

    @Test
    void resetCreatesAHistoryLineAtInitialPremium() {
        TarifUsage tarif = tariff("1872.10");
        when(tarifUsageRepository.findAll()).thenReturn(List.of(tarif));
        when(ajustementRepository.save(any(AjustementTarifUsage.class))).thenAnswer(invocation -> invocation.getArgument(0));
        ArgumentCaptor<List<LigneAjustementTarifUsage>> lines = lineCaptor();

        BulkUpdateTarifUsageRequest request = new BulkUpdateTarifUsageRequest();
        request.setTypeOperation(TypeOperationTarifUsage.REINITIALISATION);
        request.setDateDebut(LocalDate.of(2026, 9, 14));
        service.apply(request);

        LigneAjustementTarifUsage line = lines.getValue().get(0);
        assertThat(line.getPrimeNetteInitiale()).isEqualByComparingTo("1872.10");
        assertThat(line.getPrimeNetteAppliquee()).isEqualByComparingTo("1872.10");
        assertThat(tarif.getPrimeNette()).isEqualByComparingTo("1872.10");
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private ArgumentCaptor<List<LigneAjustementTarifUsage>> lineCaptor() {
        ArgumentCaptor<List<LigneAjustementTarifUsage>> captor = ArgumentCaptor.forClass((Class) List.class);
        when(ligneRepository.saveAll(captor.capture())).thenAnswer(invocation -> invocation.getArgument(0));
        return captor;
    }

    private TarifUsage tariff(String premium) {
        TarifUsage tarif = new TarifUsage();
        tarif.setId(1L);
        tarif.setActif(true);
        tarif.setPrimeNette(new BigDecimal(premium));
        return tarif;
    }

    private BulkUpdateTarifUsageRequest adjustment(String value) {
        BulkUpdateTarifUsageRequest request = new BulkUpdateTarifUsageRequest();
        request.setTypeOperation(TypeOperationTarifUsage.AJUSTEMENT);
        request.setTypeCalcul(TypeCalculAjustementTarifUsage.POURCENTAGE);
        request.setSens(SensAjustementTarifUsage.HAUSSE);
        request.setValue(new BigDecimal(value));
        request.setDateDebut(LocalDate.of(2026, 9, 14));
        return request;
    }
}
