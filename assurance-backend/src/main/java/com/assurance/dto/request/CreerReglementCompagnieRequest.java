package com.assurance.dto.request;

import com.assurance.enums.ModeReglementCompagnie;
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
public class CreerReglementCompagnieRequest {
    @NotNull
    private Long compagnieId;
    @NotNull
    private LocalDate dateReglement;
    @Size(max = 1000)
    private String notes;
    @Valid
    @NotEmpty
    private List<Instrument> instruments;

    @Data
    public static class Instrument {
        @NotNull
        private ModeReglementCompagnie mode;
        @NotNull
        @DecimalMin(value = "0.01")
        private BigDecimal montant;
        @NotNull
        private LocalDate dateInstrument;
        private LocalDate dateEcheance;
        @Size(max = 120)
        private String referenceInstrument;
        @Size(max = 160)
        private String banqueBeneficiaire;
        private Long compteTresorerieId;
        @Valid
        @NotEmpty
        private List<Affectation> affectations;
    }

    @Data
    public static class Affectation {
        @NotNull
        private Long bordereauId;
        @NotNull
        @DecimalMin(value = "0.01")
        private BigDecimal montant;
    }
}
