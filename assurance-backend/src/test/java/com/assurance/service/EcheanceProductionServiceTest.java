package com.assurance.service;

import com.assurance.entity.Contrat;
import com.assurance.enums.StatutContrat;
import com.assurance.enums.TypeContrat;
import com.assurance.repository.ContratRepository;
import com.assurance.service.renewal.RenewalPolicy;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EcheanceProductionServiceTest {

    @Mock
    private ContratRepository contratRepository;

    private final RenewalPolicy renewalPolicy = new RenewalPolicy();

    private EcheanceProductionService service;

    @Test
    void exposesSavedPreTermDraftAndCompanyTermEligibility() {
        service = new EcheanceProductionService(contratRepository, renewalPolicy);
        LocalDate dateDu = LocalDate.of(2026, 12, 1);
        LocalDate dateAu = LocalDate.of(2026, 12, 31);
        Contrat source = Contrat.builder()
                .typeContrat(TypeContrat.FLOTTE)
                .numeroDossier("DOS-10")
                .dateEcheance(dateAu)
                .typeRenouvellement("renouvelable")
                .build();
        source.setId(10L);
        Contrat draft = Contrat.builder()
                .contratOrigine(source)
                .typeContrat(TypeContrat.FLOTTE)
                .statut(StatutContrat.DRAFT)
                .brouillon(true)
                .build();
        draft.setId(20L);

        when(contratRepository.findAutomobileEcheanceIds(
                eq(1L), eq(dateDu), eq(dateAu), eq(null), eq(TypeContrat.FLOTTE), eq(null), any()
        )).thenReturn(new PageImpl<>(List.of(10L)));
        when(contratRepository.findByAgenceIdAndIdIn(1L, List.of(10L))).thenReturn(List.of(source));
        when(contratRepository.findByAgenceIdAndContratOrigineIdIn(1L, List.of(10L))).thenReturn(List.of(draft));

        var result = service.searchAutomobile(
                1L, dateDu, dateAu, null, TypeContrat.FLOTTE, null, 0, 25
        );

        assertThat(result.getRows()).singleElement().satisfies(row -> {
            assertThat(row.getPreTermeDraftId()).isEqualTo(20L);
            assertThat(row.isRenouvellementTermeCompagnieEligible()).isTrue();
        });
    }
}
