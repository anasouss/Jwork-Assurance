package com.assurance.dto.request;

import com.assurance.enums.TypePayeurPrime;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;
import java.util.List;

@Data
public class CreateAssistanceVoyageRequest {

    @NotNull
    private Long compagnieAssistanceId;

    @NotNull
    private Long produitAssistanceId;

    @NotNull
    private LocalDate dateEffet;

    @Min(6)
    @Max(60)
    private int dureeMois;

    @NotBlank
    private String numeroContrat;

    private String codePromo;

    @Valid
    @NotNull
    private Personne souscripteur;

    @Valid
    private List<Personne> assures;

    private Boolean assureIdentiqueSouscripteur;

    private TypePayeurPrime typePayeurPrime;

    private Long payeurPrimeClientId;

    /** @deprecated Kept temporarily for clients using the original insured-person index contract. */
    @Deprecated
    private Integer payeurIndex;

    @Data
    public static class Personne {
        private Long clientId;
        private LocalDate documentValidite;
        @Valid
        private CreateClientRequest client;
    }
}
