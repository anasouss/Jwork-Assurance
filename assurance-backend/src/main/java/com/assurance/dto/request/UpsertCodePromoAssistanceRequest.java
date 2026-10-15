package com.assurance.dto.request;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class UpsertCodePromoAssistanceRequest {
    @NotBlank
    private String code;

    @NotNull
    @DecimalMin(value = "0", inclusive = false)
    @DecimalMax("100")
    private BigDecimal tauxReduction;

    @NotNull
    private LocalDate dateDebut;

    private LocalDate dateFin;
    private Boolean actif;
}
