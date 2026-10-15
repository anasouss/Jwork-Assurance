package com.assurance.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;
import java.util.List;

@Data
public class QuoteAssistanceVoyageRequest {
    @NotNull
    private Long compagnieAssistanceId;
    @NotNull
    private Long produitAssistanceId;
    @NotNull
    private LocalDate dateEffet;
    @Min(6)
    @Max(60)
    private int dureeMois;
    private String codePromo;
    @NotNull
    private List<@NotNull LocalDate> datesNaissanceAssures;
}
