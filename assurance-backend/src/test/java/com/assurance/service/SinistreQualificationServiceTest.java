package com.assurance.service;

import com.assurance.entity.Agence;
import com.assurance.entity.GarageSinistre;
import com.assurance.entity.Sinistre;
import com.assurance.entity.SinistreCouverture;
import com.assurance.enums.ModeReparationSinistre;
import com.assurance.enums.TypeDommageSinistre;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.GarageSinistreRepository;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SinistreQualificationServiceTest {
    private final GarageSinistreRepository garages = mock(GarageSinistreRepository.class);
    private final SinistreQualificationService service = new SinistreQualificationService(garages);

    @Test
    void pecRequiresConfiguredActiveTenantGarageAndStoresHistoricalName() {
        Sinistre claim = automobile();
        GarageSinistre garage = GarageSinistre.builder().raisonSociale("Garage agree").conventionne(true).build();
        when(garages.findByIdAndAgenceId(9L, 1L)).thenReturn(Optional.of(garage));
        service.apply(claim, TypeDommageSinistre.MIXTE, ModeReparationSinistre.PEC, 9L, new BigDecimal("50.00"));
        assertThat(claim.getGarageNomSnapshot()).isEqualTo("Garage agree");
        assertThat(claim.getTauxResponsabilite()).isEqualByComparingTo("50");
        garage.setRaisonSociale("Nouveau nom");
        assertThat(claim.getGarageNomSnapshot()).isEqualTo("Garage agree");
        verify(garages).findByIdAndAgenceId(9L, 1L);
    }

    @Test
    void pecRejectsMissingUnapprovedOrInactiveGarage() {
        assertThatThrownBy(() -> service.apply(automobile(), TypeDommageSinistre.MATERIEL,
                ModeReparationSinistre.PEC, null, null)).isInstanceOf(BadRequestException.class);
        GarageSinistre garage = GarageSinistre.builder().raisonSociale("Non conventionne").build();
        when(garages.findByIdAndAgenceId(9L, 1L)).thenReturn(Optional.of(garage));
        assertThatThrownBy(() -> service.apply(automobile(), TypeDommageSinistre.MATERIEL,
                ModeReparationSinistre.PEC, 9L, null)).isInstanceOf(BadRequestException.class);
        garage.setConventionne(true);
        garage.setActif(false);
        assertThatThrownBy(() -> service.apply(automobile(), TypeDommageSinistre.MATERIEL,
                ModeReparationSinistre.PEC, 9L, null)).isInstanceOf(BadRequestException.class);
    }

    @Test
    void foreignAgencyGarageCannotBeAssigned() {
        assertThatThrownBy(() -> service.apply(automobile(), TypeDommageSinistre.MATERIEL,
                ModeReparationSinistre.PEC, 42L, null)).isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void responsibilityOnlyAcceptsZeroFiftyOrHundredRegardlessOfScale() {
        for (String rate : new String[]{"0", "50.0000", "100"}) {
            service.apply(automobile(), TypeDommageSinistre.CORPOREL, ModeReparationSinistre.NORMAL,
                    null, new BigDecimal(rate));
        }
        for (String rate : new String[]{"-1", "25", "50.0001", "101"}) {
            assertThatThrownBy(() -> service.apply(automobile(), TypeDommageSinistre.MATERIEL,
                    ModeReparationSinistre.NORMAL, null, new BigDecimal(rate)))
                    .isInstanceOf(BadRequestException.class).hasMessageContaining("0, 50 ou 100");
        }
    }

    @Test
    void declaredAutomobileNeedsClassificationAndRepairModeButOtherBranchesDoNot() {
        Sinistre claim = automobile();
        assertThat(SinistreQualificationService.declarationBlockers(claim)).hasSize(2);
        service.apply(claim, TypeDommageSinistre.MATERIEL, ModeReparationSinistre.RAPIDE, null, null);
        assertThat(SinistreQualificationService.declarationBlockers(claim)).isEmpty();
        claim.setCouverture(SinistreCouverture.builder().brancheCode("ASSISTANCE").build());
        assertThat(SinistreQualificationService.declarationBlockers(claim)).isEmpty();
        assertThatThrownBy(() -> service.apply(claim, TypeDommageSinistre.MATERIEL,
                ModeReparationSinistre.RAPIDE, null, null)).isInstanceOf(BadRequestException.class);
    }

    @Test
    void declarationRequiresNonBlankCompanyReferenceForEveryBranch() {
        Sinistre claim = automobile();
        service.apply(claim, TypeDommageSinistre.MATERIEL, ModeReparationSinistre.NORMAL, null, null);
        for (String branch : new String[]{"AUTOMOBILE", "ASSISTANCE"}) {
            claim.setCouverture(SinistreCouverture.builder().brancheCode(branch).build());
            for (String reference : new String[]{null, "", "   "}) {
                claim.setReferenceCompagnie(reference);
                assertThat(SinistreQualificationService.declarationBlockers(claim))
                        .containsExactly("Renseignez la reference compagnie avant de declarer le sinistre");
            }
            claim.setReferenceCompagnie(" CIE-123 ");
            assertThat(SinistreQualificationService.declarationBlockers(claim)).isEmpty();
        }
    }

    private Sinistre automobile() {
        Agence agency = new Agence();
        agency.setId(1L);
        return Sinistre.builder().agence(agency).referenceCompagnie("CIE-123")
                .couverture(SinistreCouverture.builder().brancheCode("AUTOMOBILE").build()).build();
    }
}
