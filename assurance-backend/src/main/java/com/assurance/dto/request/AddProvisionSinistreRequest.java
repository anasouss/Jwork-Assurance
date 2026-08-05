package com.assurance.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class AddProvisionSinistreRequest {

    @NotNull
    private LocalDate dateProvision;

    @NotNull
    @DecimalMin("0")
    private BigDecimal montant;

    @NotBlank
    @Size(max = 500)
    private String motif;
}
