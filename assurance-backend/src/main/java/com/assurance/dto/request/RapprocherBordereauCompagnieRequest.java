package com.assurance.dto.request;

import com.assurance.enums.StatutRapprochementCompagnie;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class RapprocherBordereauCompagnieRequest {
    @NotNull
    private StatutRapprochementCompagnie statut;
    @NotNull
    private BigDecimal ecart;
    @Size(max = 1000)
    private String note;
    private LocalDate dateAccuseReception;
    @Size(max = 160)
    private String referenceAccuseReception;
}
