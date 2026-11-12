package com.assurance.service;

import com.assurance.dto.request.CreateContratRequest;
import com.assurance.entity.Usage;
import com.assurance.enums.PeriodeCouverture;
import com.assurance.exception.BadRequestException;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.EnumSet;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class UsageContractPolicyTest {
    private final Usage frontiere = Usage.builder().fermeUniquement(true)
            .periodesAutorisees(EnumSet.of(PeriodeCouverture.J5, PeriodeCouverture.J10,
                    PeriodeCouverture.M1, PeriodeCouverture.M3, PeriodeCouverture.M6)).build();

    @Test
    void rejectsRenewableContractsForConfiguredUsage() {
        var request = request("J5");
        request.setTypeRenouvellement("renouvelable");
        assertThatThrownBy(() -> UsageContractPolicy.resolveExpiration(frontiere, request, null))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("fermes");
    }

    @Test
    void supportsExactlyTheFiveConfiguredPeriods() {
        for (var periode : frontiere.getPeriodesAutorisees()) {
            var request = request(periode.name());
            assertThat(UsageContractPolicy.resolveExpiration(frontiere, request, LocalDate.of(2030, 1, 1)))
                    .isEqualTo(periode.dateExpiration(request.getDateEffet()));
        }
        assertThatThrownBy(() -> UsageContractPolicy.resolveExpiration(frontiere, request("M12"), null))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("pas autorisee");
        assertThatThrownBy(() -> UsageContractPolicy.resolveExpiration(frontiere, request("4"), null))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("Selectionnez");
    }

    @Test
    void countsDaysInclusivelyAndHandlesYearBoundary() {
        assertThat(PeriodeCouverture.J5.dateExpiration(LocalDate.of(2026, 12, 29)))
                .isEqualTo(LocalDate.of(2027, 1, 2));
        assertThat(PeriodeCouverture.J10.dateExpiration(LocalDate.of(2026, 12, 29)))
                .isEqualTo(LocalDate.of(2027, 1, 7));
    }

    @Test
    void clampsCalendarMonthsIncludingLeapYears() {
        assertThat(PeriodeCouverture.M1.dateExpiration(LocalDate.of(2026, 1, 31)))
                .isEqualTo(LocalDate.of(2026, 2, 27));
        assertThat(PeriodeCouverture.M1.dateExpiration(LocalDate.of(2028, 1, 31)))
                .isEqualTo(LocalDate.of(2028, 2, 28));
        assertThat(PeriodeCouverture.M3.dateExpiration(LocalDate.of(2026, 11, 12)))
                .isEqualTo(LocalDate.of(2027, 2, 11));
    }

    @Test
    void unrestrictedUsagesKeepExistingDateRules() {
        var request = request("4");
        request.setTypeRenouvellement("renouvelable");
        var fallback = LocalDate.of(2027, 12, 31);
        assertThat(UsageContractPolicy.resolveExpiration(Usage.builder().build(), request, fallback))
                .isEqualTo(fallback);
    }

    @Test
    void allowsAnIncompleteDraftWithoutDatesButRequiresPeriodWhenDated() {
        var request = request(null);
        request.setDateEffet(null);
        assertThat(UsageContractPolicy.resolveExpiration(frontiere, request, null)).isNull();
        request.setDateEffet(LocalDate.of(2026, 11, 12));
        assertThatThrownBy(() -> UsageContractPolicy.resolveExpiration(frontiere, request, null))
                .isInstanceOf(BadRequestException.class);
    }

    private static CreateContratRequest request(String periodicite) {
        var request = new CreateContratRequest();
        request.setTypeRenouvellement("ferme");
        request.setPeriodicite(periodicite);
        request.setDateEffet(LocalDate.of(2026, 11, 12));
        return request;
    }
}
