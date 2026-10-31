package com.assurance.dto.request;

import com.assurance.enums.ModeReglementClient;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
public class RemplacerInstrumentReglementRequest {

    // Retained for clients submitting the original single-instrument request.
    private ModeReglementClient mode;

    @DecimalMin("0.01")
    @Digits(integer = 14, fraction = 2)
    private BigDecimal montant;

    private LocalDate dateInstrument;
    private LocalDate dateEcheance;

    @Size(max = 120)
    private String referenceInstrument;

    private Long banqueEmettriceId;

    private Long compteTresorerieId;

    private LocalDate dateRemplacement;

    @Valid
    @Size(min = 1, max = 50)
    private List<@NotNull Instrument> instruments;

    @NotBlank
    @Size(max = 500)
    private String motif;

    @Data
    public static class Instrument {
        @NotNull
        private ModeReglementClient mode;

        @NotNull
        @DecimalMin("0.01")
        @Digits(integer = 14, fraction = 2)
        private BigDecimal montant;

        private LocalDate dateInstrument;
        private LocalDate dateEcheance;

        @Size(max = 120)
        private String referenceInstrument;

        private Long banqueEmettriceId;
        private Long compteTresorerieId;
    }
}
