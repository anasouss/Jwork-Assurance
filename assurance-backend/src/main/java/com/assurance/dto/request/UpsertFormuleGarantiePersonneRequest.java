package com.assurance.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class UpsertFormuleGarantiePersonneRequest {
    private Long id;

    @NotNull
    private Long garantieId;

    private Long usageId;
    private String formule;
    private BigDecimal montantDeces;
    private BigDecimal montantInvalidite;
    private BigDecimal montantFraisMedicaux;
    private BigDecimal montantFraisHospitalisation;
    private BigDecimal montantFraisFuneraires;
    private BigDecimal montantFraisChirurgie;
    private BigDecimal primeNette;
    private BigDecimal accessoire;
    private Integer ordreAffichage;
    private Boolean actif;
}
