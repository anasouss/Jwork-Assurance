package com.assurance.dto.request;

import com.assurance.enums.ModeReglementClient;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
public class CreerReglementClientRequest {

    @NotNull
    private LocalDate dateReglement;

    private Long clientPayeurId;
    private Long groupePayeurId;

    @Size(max = 1000)
    private String notes;

    @Valid
    @NotEmpty
    private List<Instrument> instruments;

    @Data
    public static class Instrument {
        @NotNull
        private ModeReglementClient mode;

        @NotNull
        @DecimalMin(value = "0.01")
        private BigDecimal montant;

        private LocalDate dateInstrument;
        private LocalDate dateEcheance;

        @Size(max = 120)
        private String referenceInstrument;

        @Size(max = 160)
        private String banqueEmettrice;

        private Long compteTresorerieId;

        @Valid
        private List<Affectation> affectations = List.of();
    }

    @Data
    public static class Affectation {
        private Long elementFacturableId;

        private Long documentClientId;

        @NotNull
        @DecimalMin(value = "0.01")
        private BigDecimal montant;
    }
}
