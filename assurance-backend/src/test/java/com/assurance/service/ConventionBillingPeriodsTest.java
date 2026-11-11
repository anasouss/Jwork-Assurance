package com.assurance.service;

import com.assurance.entity.Convention;
import com.assurance.enums.Fractionnement;
import com.assurance.enums.TypeEcheanceConvention;
import com.assurance.exception.BadRequestException;
import org.junit.jupiter.api.Test;
import java.time.LocalDate;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ConventionBillingPeriodsTest {
    @Test
    void partialFirstQuarterStillCountsAsOneOfFourRemainingQuarters() {
        var convention = convention("01/01");
        var periods = ConventionBillingPeriods.covering(convention, LocalDate.of(2026, 2, 25), LocalDate.of(2026, 12, 31));
        assertThat(periods).hasSize(4);
        assertThat(periods.get(0).start()).isEqualTo(LocalDate.of(2026, 1, 1));
        assertThat(periods.get(0).end()).isEqualTo(LocalDate.of(2026, 3, 31));
        assertThat(periods.get(3).number()).isEqualTo(4);
    }

    @Test
    void conventionAnniversaryCanCrossCalendarYears() {
        var convention = convention("01/07");
        var periods = ConventionBillingPeriods.covering(convention, LocalDate.of(2026, 11, 10), LocalDate.of(2027, 6, 30));
        assertThat(periods).hasSize(3);
        assertThat(periods.get(0).start()).isEqualTo(LocalDate.of(2026, 10, 1));
        assertThat(periods.get(2).end()).isEqualTo(LocalDate.of(2027, 6, 30));
        assertThat(periods.get(2).year()).isEqualTo(2026);
    }

    @Test
    void dateToDateUsesTheConfiguredConventionCycleNotJanuaryByDefault() {
        var convention = convention(null);
        convention.setTypeEcheance(TypeEcheanceConvention.DATE_A_DATE);
        convention.setDateEffet(LocalDate.of(2024, 4, 15));
        var periods = ConventionBillingPeriods.cycle(convention, 2026);
        assertThat(periods.get(0).start()).isEqualTo(LocalDate.of(2026, 4, 15));
        assertThat(periods.get(3).end()).isEqualTo(LocalDate.of(2027, 4, 14));
    }

    @Test
    void missingConfigurationCannotSilentlyBecomeAnnualBilling() {
        var convention = convention("01/01");
        convention.setFractionnement(null);
        assertThatThrownBy(() -> ConventionBillingPeriods.cycle(convention, 2026)).isInstanceOf(BadRequestException.class);
    }

    private Convention convention(String anniversary) {
        return Convention.builder().typeEcheance(TypeEcheanceConvention.A_ECHEANCE).echeance(anniversary)
                .fractionnement(Fractionnement.TRIMESTRIEL).build();
    }
}
