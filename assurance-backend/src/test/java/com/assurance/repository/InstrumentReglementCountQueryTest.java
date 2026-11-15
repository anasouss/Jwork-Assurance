package com.assurance.repository;

import org.junit.jupiter.api.Test;
import org.springframework.data.jpa.repository.Query;

import java.util.Arrays;

import static org.assertj.core.api.Assertions.assertThat;

class InstrumentReglementCountQueryTest {
    @Test
    void sortedPagesUseExplicitCountsWithTheSameFiltersAndWithoutSortBindings() {
        for (String name : new String[]{"searchBankRejections", "searchByStatus"}) {
            var method = Arrays.stream(InstrumentReglementClientRepository.class.getDeclaredMethods())
                    .filter(candidate -> candidate.getName().equals(name)).findFirst().orElseThrow();
            Query query = method.getAnnotation(Query.class);
            String filters = name.equals("searchBankRejections")
                    ? InstrumentReglementClientRepository.BANK_REJECTION_FILTERS
                    : InstrumentReglementClientRepository.STATUS_FILTERS;
            assertThat(query.countQuery()).isEqualTo("select count(instrument)\n" + filters)
                    .contains(":agenceId").doesNotContain(":sortBy", ":sortDirection", "order by");
            assertThat(query.value()).contains(filters, ":sortBy", ":sortDirection", "order by");
        }
    }
}
