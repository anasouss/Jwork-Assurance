package com.assurance.service;

import com.assurance.exception.BadRequestException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReglementClientServicePolicyTest {

    @Mock
    private ParametreApplicationService parametreApplicationService;

    @InjectMocks
    private ReglementClientService service;

    @Test
    void returnsTheAgencyUnallocatedCreditLimit() {
        when(parametreApplicationService.getDecimal(eq(7L), anyString(), any()))
                .thenReturn(new BigDecimal("75.50"));

        var policy = service.paymentPolicy(7L);

        assertThat(policy.getCreditNonAffecteMaximum()).isEqualByComparingTo("75.50");
    }

    @Test
    void savesTheAgencyUnallocatedCreditLimitAtMoneyPrecision() {
        var policy = service.updatePaymentPolicy(7L, new BigDecimal("25.126"));

        assertThat(policy.getCreditNonAffecteMaximum()).isEqualByComparingTo("25.13");
        verify(parametreApplicationService).setValeur(
                eq(7L),
                anyString(),
                eq("DECIMAL"),
                eq("25.13"),
                anyString()
        );
    }

    @Test
    void rejectsANegativeLimit() {
        assertThatThrownBy(() -> service.updatePaymentPolicy(7L, new BigDecimal("-0.01")))
                .isInstanceOf(BadRequestException.class);
    }
}
