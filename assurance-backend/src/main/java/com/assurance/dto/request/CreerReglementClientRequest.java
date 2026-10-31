package com.assurance.dto.request;

import com.assurance.enums.ModeReglementClient;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Digits;
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

    private Boolean multiPayeur = false;

    @Size(max = 220)
    private String deposantNom;

    @Size(max = 1000)
    private String notes;

    @Valid
    @NotEmpty
    private List<Instrument> instruments;

    @Valid
    @Size(max = 200)
    private List<Ecart> ecarts = List.of();

    @Data
    public static class Ecart {
        @NotNull
        private Long elementFacturableId;
        private Long documentClientId;
        @NotNull
        @DecimalMin("0.01")
        @Digits(integer = 12, fraction = 2)
        private BigDecimal montant;
        @NotBlank
        @Size(max = 500)
        private String motif;
    }

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

        private Long banqueEmettriceId;

        private Boolean reglementBureau = false;

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
