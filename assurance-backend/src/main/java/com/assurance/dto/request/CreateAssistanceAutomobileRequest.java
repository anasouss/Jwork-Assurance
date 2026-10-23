package com.assurance.dto.request;

import com.assurance.enums.TypeVehiculeContrat;
import com.assurance.enums.TypePayeurPrime;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;

@Data
public class CreateAssistanceAutomobileRequest {

    @NotNull
    private Long compagnieAssistanceId;

    @NotNull
    private Long produitAssistanceId;

    @NotNull
    private Long categorieClientId;

    @NotNull
    private LocalDate dateSouscription;

    @NotNull
    private LocalDate dateEffet;

    @NotBlank
    private String echeanceCode;

    @NotNull
    @Min(1)
    private Integer dureeMois;

    @NotBlank
    private String numeroContrat;

    private String codePromo;

    @Valid
    @NotNull
    private Personne souscripteur;

    @Valid
    private Personne assure;

    private Boolean assureIdentiqueSouscripteur;

    private Boolean assurePayeur;

    private TypePayeurPrime typePayeurPrime;

    private Long payeurPrimeClientId;

    @Valid
    @NotNull
    private Vehicule vehicule;

    @Data
    public static class Personne {
        private Long clientId;

        @Valid
        private CreateClientRequest client;
    }

    @Data
    public static class Vehicule {
        @NotNull
        private TypeVehiculeContrat typeVehicule;

        @NotNull
        private Long usageId;

        private Long marqueId;
        private String marqueLibelle;
        private Long carrosserieId;
        private String carrosserieLibelle;
        private Long categorieTransportId;

        @NotBlank
        private String immatriculation;

        private LocalDate datePremiereCirculation;

        @NotNull
        private LocalDate dateExpirationCarteGrise;

        private String nombrePlaces;
    }
}
