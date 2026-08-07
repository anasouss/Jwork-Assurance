package com.assurance.dto.request;

import com.assurance.enums.ModeReglementClient;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class RemplacerInstrumentReglementRequest {

    @NotNull
    private ModeReglementClient mode;

    @NotNull
    @DecimalMin("0.01")
    private BigDecimal montant;

    private LocalDate dateInstrument;
    private LocalDate dateEcheance;

    @Size(max = 120)
    private String referenceInstrument;

    @Size(max = 160)
    private String banqueEmettrice;

    private Long compteTresorerieId;
}
