package com.assurance.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class UpsertTarifProduitAssistanceRequest {
    @NotNull
    private LocalDate dateDebut;

    private LocalDate dateFin;

    @NotNull
    private BigDecimal montantHt;

    @NotNull
    private BigDecimal montantTtc;

    private Boolean actif;
}
