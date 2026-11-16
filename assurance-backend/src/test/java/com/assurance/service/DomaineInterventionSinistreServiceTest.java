package com.assurance.service;

import com.assurance.activity.BusinessActivityRecorder;
import com.assurance.dto.request.UpsertDomaineInterventionRequest;
import com.assurance.entity.Agence;
import com.assurance.entity.BrancheAssurance;
import com.assurance.entity.DomaineInterventionSinistre;
import com.assurance.enums.TypePrestataireSinistre;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.*;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class DomaineInterventionSinistreServiceTest {
    private final DomaineInterventionSinistreRepository domains = mock(DomaineInterventionSinistreRepository.class);
    private final BrancheAssuranceRepository branches = mock(BrancheAssuranceRepository.class);
    private final GarageSinistreRepository garages = mock(GarageSinistreRepository.class);
    private final SpecialitePrestataireSinistreRepository specialties = mock(SpecialitePrestataireSinistreRepository.class);
    private final DomaineInterventionSinistreService service = new DomaineInterventionSinistreService(domains, branches,
            mock(AgenceRepository.class), garages, mock(ExpertSinistreRepository.class),
            mock(PrestataireMedicalSinistreRepository.class), specialties, mock(GarantieRepository.class),
            mock(BusinessActivityRecorder.class));

    @Test
    void configurationCannotReadAnotherAgencysDomain() {
        when(domains.findByIdAndAgenceId(10L, 1L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.configure(1L, TypePrestataireSinistre.GARAGE, new LinkedHashSet<>(), List.of(10L)))
                .isInstanceOf(ResourceNotFoundException.class);
        verify(domains).findByIdAndAgenceId(10L, 1L);
    }

    @Test
    void operatorMustBeConfiguredForDomain() {
        var domain = domain();
        when(domains.findByIdAndAgenceId(10L, 1L)).thenReturn(Optional.of(domain));
        assertThatThrownBy(() -> service.configure(1L, TypePrestataireSinistre.MEDECIN, new LinkedHashSet<>(), List.of(10L)))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("Opérateur incompatible");
    }

    @Test
    void inactiveDomainCanBeRetainedButNotNewlyAssigned() {
        var domain = domain();
        domain.setActif(false);
        when(domains.findByIdAndAgenceId(10L, 1L)).thenReturn(Optional.of(domain));
        assertThatThrownBy(() -> service.configure(1L, TypePrestataireSinistre.GARAGE, new LinkedHashSet<>(), List.of(10L)))
                .isInstanceOf(BadRequestException.class);
        var current = new LinkedHashSet<>(Set.of(domain));
        service.configure(1L, TypePrestataireSinistre.GARAGE, current, List.of(10L, 10L));
        assertThat(current).containsExactly(domain);
    }

    @Test
    void removingAnOperatorAlreadyUsedByAGarageIsRejected() {
        var domain = domain();
        var request = new UpsertDomaineInterventionRequest();
        request.setCode(domain.getCode());
        request.setLibelle(domain.getLibelle());
        request.setBrancheId(2L);
        request.setOperateurs(Set.of(TypePrestataireSinistre.EXPERT));
        when(domains.findByIdAndAgenceId(10L, 1L)).thenReturn(Optional.of(domain));
        when(branches.findById(2L)).thenReturn(Optional.of(domain.getBrancheAssurance()));
        when(garages.existsByDomainesId(10L)).thenReturn(true);
        assertThatThrownBy(() -> service.save(1L, 10L, request))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("déjà utilisé");
        verify(domains, never()).save(any());
    }

    @Test
    void startupDoesNotRecreateRenamedOrCustomizedDefaults() {
        var domain = domain();
        domain.setCode("CUSTOM");
        when(domains.findByAgenceIdOrderByLibelleAsc(1L)).thenReturn(List.of(domain));
        service.seedDefaults(domain.getAgence());
        verify(domains, never()).save(any());
        verifyNoInteractions(branches, specialties);
    }

    private DomaineInterventionSinistre domain() {
        var agency = new Agence();
        agency.setId(1L);
        var branch = new BrancheAssurance();
        branch.setId(2L);
        branch.setActif(true);
        var domain = DomaineInterventionSinistre.builder().agence(agency).code("AUTOMOBILE").libelle("Automobile")
                .brancheAssurance(branch).operateurs(new LinkedHashSet<>(Set.of(TypePrestataireSinistre.GARAGE))).build();
        domain.setId(10L);
        return domain;
    }
}
