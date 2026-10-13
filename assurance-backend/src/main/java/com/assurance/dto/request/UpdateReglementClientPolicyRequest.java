package com.assurance.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class UpdateReglementClientPolicyRequest {

    @NotNull
    @DecimalMin("0.00")
    @Digits(integer = 12, fraction = 2)
    private BigDecimal creditNonAffecteMaximum;
}
