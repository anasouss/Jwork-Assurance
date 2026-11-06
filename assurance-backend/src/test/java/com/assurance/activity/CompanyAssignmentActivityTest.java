package com.assurance.activity;

import com.assurance.entity.AffectationQuittanceCompagnie;
import com.assurance.entity.Agence;
import com.assurance.entity.BordereauCompagnie;
import com.assurance.entity.CompagnieAssurance;
import com.assurance.entity.Contrat;
import com.assurance.entity.LigneBordereauCompagnie;
import com.assurance.entity.Quittance;
import com.assurance.entity.TiersCompagnie;
import com.assurance.enums.TypeTiersCompagnie;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class CompanyAssignmentActivityTest {
    @Test
    void recreatedAssignmentIdsAndInputOrderingDoNotBecomeBusinessChanges() {
        var agency = Agence.builder().nom("Agence test").build();
        agency.setId(1L);
        var contract = Contrat.builder().agence(agency).numeroDossier("MATU26-0026").build();
        contract.setId(99L);
        var quittance = Quittance.builder().contrat(contract).numeroQuittance("Q-001").build();
        quittance.setId(103L);
        var first = assignment(quittance, "CIE-001");
        var second = assignment(quittance, "CIE-002");
        var before = CompanyAssignmentActivity.snapshot(List.of(quittance), List.of(first, second));
        first.setId(900L);
        second.setId(901L);
        var after = CompanyAssignmentActivity.snapshot(List.of(quittance), List.of(second, first));
        assertThat(ActivityValues.changes(before, after)).isEmpty();
        assertThat(after.values()).contains("source.xlsx");
        assertThat(after.values()).noneMatch(value -> value != null && value.contains("private-storage"));
    }

    @Test
    void companyBordereauLineRecreationDoesNotAppearAsAnEdit() {
        var slip = BordereauCompagnie.builder().numero("BC-001").tiersCompagnie(tier()).build();
        var first = LigneBordereauCompagnie.builder().numeroQuittanceCompagnie("CIE-001").dateEffet(LocalDate.of(2026, 11, 5)).build();
        var second = LigneBordereauCompagnie.builder().numeroQuittanceCompagnie("CIE-002").dateEffet(LocalDate.of(2026, 11, 5)).build();
        first.setId(1L);
        second.setId(2L);
        slip.getLignes().addAll(List.of(first, second));
        var before = CompanyBordereauActivity.snapshot(slip);
        first.setId(900L);
        second.setId(901L);
        slip.getLignes().clear();
        slip.getLignes().addAll(List.of(second, first));
        assertThat(ActivityValues.changes(before, CompanyBordereauActivity.snapshot(slip))).isEmpty();
    }

    private AffectationQuittanceCompagnie assignment(Quittance quittance, String number) {
        return AffectationQuittanceCompagnie.builder().quittance(quittance).tiersCompagnie(tier()).numeroQuittanceCompagnie(number)
                .dateEffet(LocalDate.of(2026, 11, 5)).fichierSource("C:\\private-storage\\source.xlsx").build();
    }

    private TiersCompagnie tier() {
        var company = CompagnieAssurance.builder().nom("MATU").build();
        company.setId(4L);
        var tier = TiersCompagnie.builder().compagnieAssurance(company).type(TypeTiersCompagnie.ASSURANCE).build();
        tier.setId(8L);
        return tier;
    }
}
