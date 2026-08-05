package com.assurance.dto.request;

import com.assurance.enums.TypeOperationSinistre;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class AddSinistreOperationRequest {

    @NotNull
    private TypeOperationSinistre type;

    @NotNull
    private LocalDate dateOperation;

    @NotNull
    @DecimalMin("0.01")
    private BigDecimal montant;

    @Size(max = 120)
    private String reference;

    @Size(max = 180)
    private String beneficiaire;

    @Size(max = 80)
    private String modeReglement;

    @Size(max = 500)
    private String notes;
}
