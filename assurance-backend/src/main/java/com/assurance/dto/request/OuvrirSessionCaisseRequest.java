package com.assurance.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class OuvrirSessionCaisseRequest {
    @NotNull
    private Long compteTresorerieId;

    @NotNull
    @DecimalMin(value = "0.00")
    private BigDecimal montantCompte;

    @Size(max = 1000)
    private String note;
}
