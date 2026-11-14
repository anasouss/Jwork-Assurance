package com.assurance.service;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SignedClientBalanceTest {
    @Test
    void mixedSelectionUsesItsAbsoluteNetNotItsGrossLines() {
        BigDecimal refund = new BigDecimal("100.00").add(new BigDecimal("-250.00"));
        SignedClientBalance.requireExactNet(refund, new BigDecimal("150.00"));
        BigDecimal collection = new BigDecimal("300.00").add(new BigDecimal("-100.00"));
        SignedClientBalance.requireExactNet(collection, new BigDecimal("200.00"));
        assertThatThrownBy(() -> SignedClientBalance.requireExactNet(refund, new BigDecimal("350.00")))
                .isInstanceOf(com.assurance.exception.BadRequestException.class);
    }

    @Test
    void zeroNetCannotGenerateAnIncomingOrOutgoingPayment() {
        assertThatThrownBy(() -> SignedClientBalance.requireExactNet(BigDecimal.ZERO, BigDecimal.ZERO))
                .isInstanceOf(com.assurance.exception.BadRequestException.class);
    }

    @Test
    void unpaidRefundRemainsNegativeRatherThanBeingMarkedPaid() {
        assertThat(SignedClientBalance.remaining(new BigDecimal("-100.00"), BigDecimal.ZERO))
                .isEqualByComparingTo("-100.00");
        assertThat(SignedClientBalance.covered(new BigDecimal("-100.00"), BigDecimal.ZERO)).isFalse();
    }

    @Test
    void partialAndFullRefundsRespectTheNegativeDirection() {
        assertThat(SignedClientBalance.remaining(new BigDecimal("-100.00"), new BigDecimal("-30.00")))
                .isEqualByComparingTo("-70.00");
        assertThat(SignedClientBalance.remaining(new BigDecimal("-100.00"), new BigDecimal("-100.00"))).isZero();
        assertThat(SignedClientBalance.covered(new BigDecimal("-100.00"), new BigDecimal("-100.00"))).isTrue();
    }

    @Test
    void cancellingRefundAllocationsReopensItsOriginalLiability() {
        BigDecimal total = new BigDecimal("-100.00");
        assertThat(SignedClientBalance.remaining(total, total)).isZero();
        assertThat(SignedClientBalance.remaining(total, BigDecimal.ZERO)).isEqualByComparingTo(total);
    }

    @Test
    void ordinaryReceivablesKeepTheirExistingPositiveBehaviour() {
        assertThat(SignedClientBalance.remaining(new BigDecimal("100.00"), new BigDecimal("30.00")))
                .isEqualByComparingTo("70.00");
        assertThat(SignedClientBalance.remaining(new BigDecimal("100.00"), new BigDecimal("110.00"))).isZero();
        assertThat(SignedClientBalance.covered(new BigDecimal("100.00"), BigDecimal.ZERO)).isFalse();
    }
}
