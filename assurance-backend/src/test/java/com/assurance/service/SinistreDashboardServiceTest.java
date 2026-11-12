package com.assurance.service;

import com.assurance.enums.EtapeSuiviSinistre;
import com.assurance.enums.StatutSinistre;
import com.assurance.repository.ProvisionSinistreRepository;
import com.assurance.repository.SinistreOperationRepository;
import com.assurance.repository.SinistreRepository;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SinistreDashboardServiceTest {

    @Test
    void expertiseCountUsesBothOperationalPhasesAndOnlyOpenClaimsOfCurrentAgency() {
        var claims = mock(SinistreRepository.class);
        var provisions = mock(ProvisionSinistreRepository.class);
        var operations = mock(SinistreOperationRepository.class);
        var mapper = mock(SinistreResponseMapper.class);
        when(claims.countByAgenceIdAndEtapeSuiviInAndStatutIn(eq(7L),
                eq(List.of(EtapeSuiviSinistre.EXPERTISE_AVANT, EtapeSuiviSinistre.EXPERTISE_APRES)),
                argThat(statuses -> statuses.contains(StatutSinistre.DECLARE)
                        && !statuses.contains(StatutSinistre.ANNULE)
                        && !statuses.contains(StatutSinistre.CLOTURE))))
                .thenReturn(3L);

        var result = new SinistreDashboardService(claims, provisions, operations, mapper).get(7L);

        assertThat(result.getEnExpertise()).isEqualTo(3);
        verify(claims).countByAgenceIdAndEtapeSuiviInAndStatutIn(eq(7L),
                eq(List.of(EtapeSuiviSinistre.EXPERTISE_AVANT, EtapeSuiviSinistre.EXPERTISE_APRES)),
                argThat(statuses -> !statuses.contains(StatutSinistre.REJETE)));
    }
}
