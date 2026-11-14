package com.assurance.service;

import com.assurance.exception.BadRequestException;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ConventionDocumentPolarityTest {
    @Test
    void positiveAndNegativeInvoicesKeepTheirOwnDirection() {
        assertThat(ConventionDocumentPolarity.direction(List.of(BigDecimal.TEN, BigDecimal.ZERO))).isEqualTo(1);
        assertThat(ConventionDocumentPolarity.direction(List.of(BigDecimal.TEN.negate(), BigDecimal.ZERO))).isEqualTo(-1);
    }

    @Test
    void mixedLinesAreRejectedRegardlessOfTheirNetTotal() {
        for (String negative : List.of("-5", "-10", "-20")) {
            assertThatThrownBy(() -> ConventionDocumentPolarity.direction(
                    List.of(BigDecimal.TEN, new BigDecimal(negative))))
                    .isInstanceOf(BadRequestException.class);
        }
    }

    @Test
    void emptyZeroAndMissingAmountsCannotBeIssued() {
        assertThatThrownBy(() -> ConventionDocumentPolarity.direction(List.of()))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> ConventionDocumentPolarity.direction(List.of(BigDecimal.ZERO)))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> ConventionDocumentPolarity.direction(Arrays.asList(BigDecimal.TEN, null)))
                .isInstanceOf(BadRequestException.class);
    }
}
