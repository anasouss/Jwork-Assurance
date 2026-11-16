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
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class PrestataireSinistreServiceTest {
    private final SpecialitePrestataireSinistreRepository specialties = mock(SpecialitePrestataireSinistreRepository.class);
    private final GarageSinistreRepository garages = mock(GarageSinistreRepository.class);
    private final ExpertSinistreRepository experts = mock(ExpertSinistreRepository.class);
    private final SinistreGarantieRepository guarantees = mock(SinistreGarantieRepository.class);
    private final UsageRepository usages = mock(UsageRepository.class);
    private final CompagnieAssuranceRepository companies = mock(CompagnieAssuranceRepository.class);
    private final SinistreCouvertureService coverage = mock(SinistreCouvertureService.class);
    private final PrestataireSinistreService service = new PrestataireSinistreService(specialties,
            mock(GarantieRepository.class), mock(BrancheAssuranceRepository.class), companies, mock(AgenceRepository.class),
            experts, garages, mock(PrestataireMedicalSinistreRepository.class), mock(DomaineInterventionSinistreService.class),
            mock(SinistreRepository.class), guarantees,
            coverage, mock(BusinessActivityRecorder.class), usages);
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

    @Test
    void pecApprovalRequiresTheUsageOfTheSameCompanyAgreementEvenWithAllCompaniesEnabled() {
        var garage = garage();
        var first = agreement(garage, 4L, null, null);
        first.setTousUsages(false);
        first.getUsages().add(usage(10L));
        var second = agreement(garage, 5L, null, null);
        second.setTousUsages(false);
        second.getUsages().add(usage(11L));
        garage.getAccords().addAll(List.of(first, second));
        when(garages.findByAgenceIdAndActifTrueOrderByRaisonSocialeAsc(1L)).thenReturn(List.of(garage));
        assertThat(service.eligibleGarages(new PrestataireSinistreService.Eligibility(1L, 4L, Set.of(), date, ModeReparationSinistre.PEC, 10L)))
                .containsExactly(garage);
        assertThat(service.eligibleGarages(new PrestataireSinistreService.Eligibility(1L, 4L, Set.of(), date, ModeReparationSinistre.PEC, 11L))).isEmpty();
        assertThat(service.eligibleGarages(new PrestataireSinistreService.Eligibility(1L, 4L, Set.of(), date, ModeReparationSinistre.PEC, null))).isEmpty();
        assertThat(service.eligibleGarages(new PrestataireSinistreService.Eligibility(1L, 5L, Set.of(), date, ModeReparationSinistre.PEC, 11L)))
                .containsExactly(garage);
        first.setDateFin(date.minusDays(1));
        assertThat(service.eligibleGarages(new PrestataireSinistreService.Eligibility(1L, 4L, Set.of(), date, ModeReparationSinistre.PEC, 10L))).isEmpty();
    }

    @Test
    void assignmentUsesHistoricalCoverageUsageInsteadOfCurrentContractUsage() {
        var garage = garage();
        var agreement = agreement(garage, 4L, null, null);
        agreement.setTousUsages(false);
        agreement.getUsages().add(usage(11L));
        garage.getAccords().add(agreement);
        var claim = Sinistre.builder().agence(agency(1L)).compagnieAssurance(company(4L))
                .contrat(Contrat.builder().usage(usage(11L)).build())
                .couverture(SinistreCouverture.builder().usage(usage(10L)).build()).build();
        claim.setId(20L);
        assertThatThrownBy(() -> service.assertGarage(claim, garage, ModeReparationSinistre.PEC, date))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("usage");
        agreement.getUsages().add(usage(10L));
        assertThatCode(() -> service.assertGarage(claim, garage, ModeReparationSinistre.PEC, date)).doesNotThrowAnyException();
    }

    @Test
    void declarationPreviewUsesEffectiveVehicleSnapshotUsage() {
        var contract = Contrat.builder().usage(usage(11L)).compagnieAssurance(company(4L)).build();
        var vehicle = MouvementVehicule.builder().usage(usage(10L)).build();
        when(coverage.resolve(1L, 2L, 3L, date)).thenReturn(new SinistreCouvertureService.CouvertureResolue(
                contract, null, null, null, vehicle, List.of(), List.of(vehicle)));
        var context = service.context(1L, null, 2L, 3L, date, Set.of(), date, ModeReparationSinistre.PEC);
        assertThat(context.usageId()).isEqualTo(10L);
    }

    @Test
    void agreementConfigurationRejectsEmptyUnknownAndNewInactiveUsages() {
        when(companies.findById(4L)).thenReturn(Optional.of(company(4L)));
        var row = new com.assurance.dto.request.ConfigurationPrestataireRequest.Accord();
        row.setCompagnieId(4L);
        row.setTousUsages(false);
        row.setUsageIds(List.of());
        var request = new UpsertGarageSinistreRequest();
        request.setAccords(List.of(row));
        assertThatThrownBy(() -> service.configure(garage(), request)).isInstanceOf(BadRequestException.class).hasMessageContaining("au moins un usage");
        row.setUsageIds(List.of(10L));
        when(usages.findAllById(any())).thenReturn(List.of());
        assertThatThrownBy(() -> service.configure(garage(), request)).isInstanceOf(BadRequestException.class).hasMessageContaining("introuvable");
        var inactive = usage(10L);
        inactive.setActif(false);
        when(usages.findAllById(any())).thenReturn(List.of(inactive));
        assertThatThrownBy(() -> service.configure(garage(), request)).isInstanceOf(BadRequestException.class).hasMessageContaining("inactif");
    }

    @Test
    void legacyUpdatesPreserveExistingUsageRestrictions() {
        var garage = garage();
        var existing = agreement(garage, 4L, null, null);
        existing.setTousUsages(false);
        existing.getUsages().add(usage(10L));
        garage.getAccords().add(existing);
        when(companies.findById(4L)).thenReturn(Optional.of(company(4L)));
        var row = new com.assurance.dto.request.ConfigurationPrestataireRequest.Accord();
        row.setCompagnieId(4L);
        var request = new UpsertGarageSinistreRequest();
        request.setAccords(List.of(row));
        service.configure(garage, request);
        assertThat(existing.isTousUsages()).isFalse();
        assertThat(existing.getUsages()).extracting(Usage::getId).containsExactly(10L);
    }

    private Usage usage(Long id) {
        var usage = Usage.builder().code("U" + id).libelle("Usage " + id).build();
        usage.setId(id);
        return usage;
    }

    private PrestataireSinistreService.Eligibility context(Long company, LocalDate intervention, ModeReparationSinistre mode, Set<Long> ids) {
        return new PrestataireSinistreService.Eligibility(1L, company, ids, intervention, mode, null);
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
