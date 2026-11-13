package com.assurance.dto.request;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class UpdateSinistreRequest {

    @Size(max = 100)
    private String referenceCompagnie;

    @DecimalMin("0")
    @DecimalMax("100")
    private BigDecimal tauxResponsabilite;

    @Size(max = 4000)
    private String notes;

    private Long gestionnaireId;

    @Size(max = 500)
    private String prochaineAction;

    private LocalDate dateEcheanceAction;

    private com.assurance.enums.TypeDommageSinistre typeDommage;

    private com.assurance.enums.ModeReparationSinistre modeReparation;

    private Long garageId;
}
