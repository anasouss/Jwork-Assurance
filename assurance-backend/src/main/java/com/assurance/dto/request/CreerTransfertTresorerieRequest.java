package com.assurance.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@Setter
public class CreerTransfertTresorerieRequest {
    @NotNull
    private Long compteSourceId;

    @NotNull
    private Long compteDestinationId;

    @NotNull
    @DecimalMin(value = "0.01")
    private BigDecimal montant;

    @NotNull
    private LocalDate dateOperation;

    private LocalDate dateValeur;

    @Size(max = 160)
    private String reference;

    @NotBlank
    @Size(max = 1000)
    private String motif;
}
