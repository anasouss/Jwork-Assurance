package com.assurance.service;

import com.assurance.activity.BusinessActivityRecorder;
import com.assurance.dto.request.UpsertGarageSinistreRequest;
import com.assurance.entity.*;
import com.assurance.enums.ModeReparationSinistre;
import com.assurance.enums.TypePrestataireSinistre;
import com.assurance.exception.BadRequestException;
import com.assurance.repository.*;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class PrestataireSinistreServiceTest {
    private final SpecialitePrestataireSinistreRepository specialties = mock(SpecialitePrestataireSinistreRepository.class);
    private final GarageSinistreRepository garages = mock(GarageSinistreRepository.class);
    private final ExpertSinistreRepository experts = mock(ExpertSinistreRepository.class);
    private final SinistreGarantieRepository guarantees = mock(SinistreGarantieRepository.class);
    private final PrestataireSinistreService service = new PrestataireSinistreService(specialties,
            mock(GarantieRepository.class), mock(CompagnieAssuranceRepository.class), mock(AgenceRepository.class),
            experts, garages, mock(SinistreRepository.class), guarantees,
            mock(SinistreCouvertureService.class), mock(BusinessActivityRecorder.class));
    private final LocalDate date = LocalDate.of(2026, 11, 13);

    @Test
    void pecApprovalIsSpecificToCompanyAndInterventionDate() {
        var garage = garage();
        garage.getAccords().add(agreement(garage, 4L, date.minusDays(1), date));
        when(garages.findByAgenceIdAndActifTrueOrderByRaisonSocialeAsc(1L)).thenReturn(List.of(garage));
        assertThat(service.eligibleGarages(context(4L, date, ModeReparationSinistre.PEC, Set.of()))).containsExactly(garage);
        assertThat(service.eligibleGarages(context(5L, date, ModeReparationSinistre.PEC, Set.of()))).isEmpty();
        assertThat(service.eligibleGarages(context(4L, date.plusDays(1), ModeReparationSinistre.PEC, Set.of()))).isEmpty();
        garage.getAccords().add(agreement(garage, 5L, null, null));
        assertThat(service.eligibleGarages(context(5L, date, ModeReparationSinistre.PEC, Set.of()))).containsExactly(garage);
        garage.getAccords().forEach(a -> a.setActif(false));
        assertThat(service.eligibleGarages(context(4L, date, ModeReparationSinistre.PEC, Set.of()))).isEmpty();
    }

    @Test
    void specialtiesUseGuaranteeIdsAndRequireAllMappedSelectedGuarantees() {
        var glass = specialty(1L, 10L, TypePrestataireSinistre.GARAGE);
        var body = specialty(2L, 11L, TypePrestataireSinistre.GARAGE);
        var expertSpecialty = specialty(3L, 12L, TypePrestataireSinistre.EXPERT);
        when(specialties.findByAgenceIdOrderByLibelleAsc(1L)).thenReturn(List.of(glass, body, expertSpecialty));
        var glassGarage = garage();
        glassGarage.getSpecialites().add(glass);
        var generalGarage = garage();
        generalGarage.getSpecialites().addAll(List.of(glass, body));
        when(garages.findByAgenceIdAndActifTrueOrderByRaisonSocialeAsc(1L)).thenReturn(List.of(glassGarage, generalGarage));
        assertThat(service.eligibleGarages(context(4L, date, ModeReparationSinistre.NORMAL, Set.of(10L, 12L))))
                .containsExactly(glassGarage, generalGarage);
        assertThat(service.eligibleGarages(context(4L, date, ModeReparationSinistre.NORMAL, Set.of(10L, 11L))))
                .containsExactly(generalGarage);
        glass.setActif(false);
        assertThat(service.eligibleGarages(context(4L, date, ModeReparationSinistre.NORMAL, Set.of(10L))))
                .containsExactly(glassGarage, generalGarage);
    }

    @Test
    void restrictedProvidersNeedAnActiveAgreement() {
        var garage = garage();
        garage.setToutesCompagnies(false);
        when(garages.findByAgenceIdAndActifTrueOrderByRaisonSocialeAsc(1L)).thenReturn(List.of(garage));
        assertThat(service.eligibleGarages(context(4L, date, ModeReparationSinistre.NORMAL, Set.of()))).isEmpty();
        var agreement = agreement(garage, 4L, null, null);
        agreement.setConventionne(false);
        garage.getAccords().add(agreement);
        assertThat(service.eligibleGarages(context(4L, date, ModeReparationSinistre.NORMAL, Set.of()))).containsExactly(garage);
        assertThat(service.eligibleGarages(context(4L, date, ModeReparationSinistre.PEC, Set.of()))).isEmpty();
    }

    @Test
    void assignmentRejectsCrossAgencyInactiveOrIncompatibleProviders() {
        var claim = Sinistre.builder().agence(agency(1L)).compagnieAssurance(company(4L)).build();
        claim.setId(20L);
        var garage = garage();
        garage.setAgence(agency(2L));
        assertThatThrownBy(() -> service.assertGarage(claim, garage, ModeReparationSinistre.NORMAL, date)).isInstanceOf(BadRequestException.class);
        garage.setAgence(agency(1L));
        garage.setActif(false);
        assertThatThrownBy(() -> service.assertGarage(claim, garage, ModeReparationSinistre.NORMAL, date)).isInstanceOf(BadRequestException.class);
        var expert = ExpertSinistre.builder().agence(agency(2L)).build();
        assertThatThrownBy(() -> service.assertExpert(claim, expert, date)).isInstanceOf(BadRequestException.class);
        garage.setActif(true);
        var required = specialty(1L, 10L, TypePrestataireSinistre.GARAGE);
        when(specialties.findByAgenceIdOrderByLibelleAsc(1L)).thenReturn(List.of(required));
        when(guarantees.findForDetailOrderByConfiguredDisplay(20L)).thenReturn(List.of(
                SinistreGarantie.builder().garantie(required.getGaranties().iterator().next()).impliquee(true).build()));
        assertThatThrownBy(() -> service.assertGarage(claim, garage, ModeReparationSinistre.NORMAL, date)).isInstanceOf(BadRequestException.class);
    }

    @Test
    void configurationRejectsSpecialtiesOfAnotherAgencyOrProviderType() {
        var request = new UpsertGarageSinistreRequest();
        request.setSpecialiteIds(List.of(5L));
        var expertSpecialty = specialty(5L, 10L, TypePrestataireSinistre.EXPERT);
        when(specialties.findByAgenceIdOrderByLibelleAsc(1L)).thenReturn(List.of(expertSpecialty));
        assertThatThrownBy(() -> service.configure(garage(), request)).isInstanceOf(BadRequestException.class);
        when(specialties.findByAgenceIdOrderByLibelleAsc(1L)).thenReturn(List.of());
        assertThatThrownBy(() -> service.configure(garage(), request)).isInstanceOf(BadRequestException.class);
    }

    private PrestataireSinistreService.Eligibility context(Long company, LocalDate intervention, ModeReparationSinistre mode, Set<Long> ids) {
        return new PrestataireSinistreService.Eligibility(1L, company, ids, intervention, mode);
    }

    private GarageSinistre garage() {
        return GarageSinistre.builder().agence(agency(1L)).raisonSociale("Garage").build();
    }

    private Agence agency(Long id) {
        var agency = new Agence();
        agency.setId(id);
        return agency;
    }

    private CompagnieAssurance company(Long id) {
        var company = new CompagnieAssurance();
        company.setId(id);
        return company;
    }

    private AccordPrestataireSinistre agreement(GarageSinistre garage, Long company, LocalDate start, LocalDate end) {
        return AccordPrestataireSinistre.builder().agence(garage.getAgence()).garage(garage).compagnie(company(company))
                .conventionne(true).dateDebut(start).dateFin(end).build();
    }

    private SpecialitePrestataireSinistre specialty(Long id, Long guaranteeId, TypePrestataireSinistre type) {
        var guarantee = new Garantie();
        guarantee.setId(guaranteeId);
        var specialty = SpecialitePrestataireSinistre.builder().agence(agency(1L)).typePrestataire(type)
                .garanties(new LinkedHashSet<>(List.of(guarantee))).build();
        specialty.setId(id);
        return specialty;
    }
}
