package com.assurance.service;

import com.assurance.activity.BusinessActivityRecorder;
import com.assurance.entity.ExpertSinistre;
import com.assurance.entity.GarageSinistre;
import com.assurance.entity.PrestataireMedicalSinistre;
import com.assurance.entity.AccordPrestataireSinistre;
import com.assurance.entity.CompagnieAssurance;
import com.assurance.enums.TypePrestataireSinistre;
import com.assurance.exception.BadRequestException;
import com.assurance.repository.*;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;

import java.util.List;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class SinistreProviderDirectoryTest {
    private final PrestataireMedicalSinistreRepository medical = mock(PrestataireMedicalSinistreRepository.class);
    private final PrestataireSinistreService providers = mock(PrestataireSinistreService.class);
    private final ExpertSinistreRepository experts = mock(ExpertSinistreRepository.class);
    private final GarageSinistreRepository garages = mock(GarageSinistreRepository.class);
    private final DomaineInterventionSinistreService domains = mock(DomaineInterventionSinistreService.class);
    private final PrestataireDirectoryRepository directory = mock(PrestataireDirectoryRepository.class);
    private final SinistreIntervenantService service = new SinistreIntervenantService(mock(AgenceRepository.class),
            mock(VilleRepository.class), experts, garages,
            mock(BusinessActivityRecorder.class), providers, medical, domains, directory);

    @Test
    void allOperatorsPreserveGlobalPaginationAndSeparateOverlappingProviderIds() {
        var keys = List.of(new PrestataireDirectoryRepository.ProviderKey(TypePrestataireSinistre.EXPERT, 1L),
                new PrestataireDirectoryRepository.ProviderKey(TypePrestataireSinistre.GARAGE, 1L));
        var filter = new PrestataireDirectoryRepository.Filter(7L, false, "test", 8L, 9L, null, 10L);
        var pageable = PageRequest.of(1, 2);
        when(directory.search(filter, pageable)).thenReturn(new PageImpl<>(keys, pageable, 8));
        var expert = ExpertSinistre.builder().nom("Expert").build();
        expert.setId(1L);
        var garage = GarageSinistre.builder().raisonSociale("Garage").build();
        garage.setId(1L);
        when(experts.findByAgenceIdAndIdIn(7L, List.of(1L))).thenReturn(List.of(expert));
        when(garages.findByAgenceIdAndIdIn(7L, List.of(1L))).thenReturn(List.of(garage));
        var result = service.directoryAll(7L, false, "test", 8L, 9L, null, null, 10L, 1, 2);
        assertThat(result.getItems()).extracting(item -> item.getTypePrestataire())
                .containsExactly(TypePrestataireSinistre.EXPERT, TypePrestataireSinistre.GARAGE);
        assertThat(result.getPage().getTotalElements()).isEqualTo(8);
        assertThat(result.getPage().getNumber()).isEqualTo(1);
        verify(domains).require(7L, 10L);
        verifyNoInteractions(medical);
    }

    @Test
    void allOperatorsRejectsASpecialtyWithoutItsOperatorType() {
        assertThatThrownBy(() -> service.directoryAll(1L, false, null, null, null, 3L, null, null, 0, 25))
                .isInstanceOf(BadRequestException.class);
        verifyNoInteractions(directory);
    }

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

    @Test
    void directoryConventionStatusRejectsExpiredFutureInactiveAndEmptyRestrictedAgreements() {
        var garage = GarageSinistre.builder().raisonSociale("Garage").build();
        var today = LocalDate.now();
        for (int index = 1; index <= 5; index++) {
            var company = CompagnieAssurance.builder().nom("Compagnie " + index).build();
            company.setId((long) index);
            var agreement = AccordPrestataireSinistre.builder().garage(garage).compagnie(company).conventionne(true).build();
            if (index == 1) {
                agreement.setDateDebut(today);
                agreement.setDateFin(today);
            }
            if (index == 2) agreement.setDateFin(today.minusDays(1));
            if (index == 3) agreement.setDateDebut(today.plusDays(1));
            if (index == 4) agreement.setActif(false);
            if (index == 5) agreement.setTousUsages(false);
            garage.getAccords().add(agreement);
        }
        when(garages.findByAgenceIdAndActifTrueOrderByRaisonSocialeAsc(1L)).thenReturn(List.of(garage));
        var result = service.listGarages(1L, false).get(0);
        assertThat(result.getAccords()).extracting(accord -> accord.conventionneActuellement())
                .containsExactly(true, false, false, false, false);
        garage.setActif(false);
        when(garages.findByAgenceIdOrderByRaisonSocialeAsc(1L)).thenReturn(List.of(garage));
        assertThat(service.listGarages(1L, true).get(0).getAccords())
                .allMatch(accord -> !accord.conventionneActuellement());
    }
}
