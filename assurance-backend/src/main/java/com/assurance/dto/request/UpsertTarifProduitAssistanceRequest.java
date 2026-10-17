package com.assurance.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class UpsertTarifProduitAssistanceRequest {
    @NotNull
    private LocalDate dateDebut;

    private LocalDate dateFin;

    private Integer ageMin;

    private Integer ageMax;

    @NotNull
    @Min(1)
    private Integer dureeMois;

    @NotNull
    private BigDecimal montantHt;

    @NotNull
    private BigDecimal montantTtc;

    private Boolean actif;
}
