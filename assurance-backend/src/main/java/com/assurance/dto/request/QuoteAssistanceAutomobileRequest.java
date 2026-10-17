package com.assurance.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;

@Data
public class QuoteAssistanceAutomobileRequest {
    @NotNull
    private Long compagnieAssistanceId;
    @NotNull
    private Long produitAssistanceId;
    @NotNull
    private Long categorieClientId;
    @NotNull
    private Long usageId;
    @NotNull
    private LocalDate dateEffet;
    @NotNull
    @Min(1)
    private Integer dureeMois;
    private String codePromo;
}
