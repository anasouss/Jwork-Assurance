package com.assurance.activity;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class ActivityValuesTest {
    @Test
    void ignoresUnchangedValuesButRetainsRemovalsAndFirstEntries() {
        var before = new ActivityValues().put("Police", "123").put("Immatriculation", "ABC").snapshot();
        var after = new ActivityValues().put("Police", "123").put("Immatriculation", null)
                .put("Validite", LocalDate.of(2027, 1, 1)).snapshot();

        assertThat(ActivityValues.changes(before, after)).containsExactly(
                new ActivityChange("Immatriculation", "ABC", null),
                new ActivityChange("Validite", null, "01/01/2027"));
        assertThat(ActivityValues.changes(after, after)).isEmpty();
    }

    @Test
    void formatsNumbersWithoutLosingMeaningfulRatePrecision() {
        var values = new ActivityValues().put("Montant", new BigDecimal("1234.50"))
                .put("Taux", new BigDecimal("0.012345"))
                .put("Actif", true).snapshot();

        assertThat(values).containsEntry("Montant", "1 234,50")
                .containsEntry("Taux", "0,012345").containsEntry("Actif", "Oui");
        assertThat(ActivityValues.changes(Map.of(), values)).hasSize(3);
    }
}
