package com.assurance.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class UpsertFormuleGarantiePersonneRequest {
    private String id;

    @NotBlank
    private String garantieId;

    private String usageId;
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
