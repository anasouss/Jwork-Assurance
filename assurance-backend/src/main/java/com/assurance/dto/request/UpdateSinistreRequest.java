package com.assurance.dto.request;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class UpdateSinistreRequest {

    @Size(max = 100)
    private String referenceCompagnie;

    private Long villeId;

    @Size(max = 500)
    private String lieu;

    @Size(max = 4000)
    private String circonstances;

    @Size(max = 120)
    private String numeroPv;

    @DecimalMin("0")
    @DecimalMax("100")
    private BigDecimal tauxResponsabilite;

    @Size(max = 4000)
    private String notes;

    private Long gestionnaireId;
}
