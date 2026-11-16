package com.assurance.service;

import com.assurance.activity.BusinessActivityRecorder;
import com.assurance.entity.PrestataireMedicalSinistre;
import com.assurance.enums.TypePrestataireSinistre;
import com.assurance.exception.BadRequestException;
import com.assurance.repository.*;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;

import java.util.List;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class SinistreProviderDirectoryTest {
    private final PrestataireMedicalSinistreRepository medical = mock(PrestataireMedicalSinistreRepository.class);
    private final PrestataireSinistreService providers = mock(PrestataireSinistreService.class);
    private final SinistreIntervenantService service = new SinistreIntervenantService(mock(AgenceRepository.class),
            mock(VilleRepository.class), mock(ExpertSinistreRepository.class), mock(GarageSinistreRepository.class),
            mock(BusinessActivityRecorder.class), providers, medical, mock(DomaineInterventionSinistreService.class));

    @Test
    @SuppressWarnings("unchecked")
    void medicalDirectorySortsByNomNotGarageRaisonSociale() {
        when(medical.findAll(any(Specification.class), any(Pageable.class))).thenAnswer(invocation -> {
            Pageable page = invocation.getArgument(1);
            assertThat(page.getSort().getOrderFor("nom")).isNotNull();
            assertThat(page.getSort().getOrderFor("raisonSociale")).isNull();
            return new PageImpl<PrestataireMedicalSinistre>(List.of(), page, 0);
        });
        var result = service.directory(1L, TypePrestataireSinistre.CLINIQUE, false, null, null, null, null, null, null, 0, 25);
        assertThat(result.getItems()).isEmpty();
        verify(providers).validateDirectorySpecialty(1L, TypePrestataireSinistre.CLINIQUE, null, null);
    }

    @Test
    void medicalOperatorNeverFallsThroughToGarageClaimEligibility() {
        assertThatThrownBy(() -> service.eligible(TypePrestataireSinistre.MEDECIN, null))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("parcours dédié");
        verifyNoInteractions(providers, medical);
    }
}
