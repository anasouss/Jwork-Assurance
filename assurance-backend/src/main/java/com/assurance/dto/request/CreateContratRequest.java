package com.assurance.dto.request;

import com.assurance.enums.Fractionnement;
import com.assurance.enums.ModeSaisieGarantieContrat;
import com.assurance.enums.CategorieQuittance;
import com.assurance.enums.TypeVehiculeContrat;
import com.assurance.enums.RoleClientContrat;
import com.assurance.enums.TypeContrat;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
public class CreateContratRequest {
    @NotNull
    private Long agenceId;

    private Long compagnieAssuranceId;
    private Long conventionId;
    private Long usageId;
    private Long grilleTarifaireId;

    @NotNull
    private TypeContrat typeContrat;

    @NotBlank
    private String numeroContrat;

    private String numeroDevis;
    private String numeroDossier;
    private String numeroPolice;
    private String numeroAttestation;
    private LocalDate dateEffet;
    private LocalDate dateEcheance;
    private String echeance;
    private String typeRenouvellement;
    private String modePaiement;
    private String modeReglement;
    private String numeroBonCommande;
    private String periodicite;
    private Fractionnement fractionnement;
    private BigDecimal tauxRc;
    private ModeSaisieGarantieContrat modeSaisieGaranties;
    private Boolean saisiePrimeNette;
    private Integer nombreVehicules;
    private Integer nombreRemorques;
    private Boolean prospection;
    private Boolean assistance;
    private Boolean crmPartage;
    private String crmPartageValeur;
    private String notes;

    @Valid
    private List<ClientInput> clients;

    @Valid
    private List<VehiculeInput> vehicules;

    @Valid
    private List<RemorqueInput> remorques;

    @Valid
    private List<GarantieInput> garanties;

    @Valid
    private List<QuittanceInput> quittances;

    @Data
    public static class ClientInput {
        private Long clientId;
        private RoleClientContrat sameAsRole;
        private CreateClientRequest client;
        @NotNull
        private RoleClientContrat role;
        private boolean principalPourRole;
    }

    @Data
    public static class VehiculeInput {
        @NotNull
        private TypeVehiculeContrat typeVehicule;
        private Long usageId;
        private Long marqueId;
        private String marqueLibelle;
        private Long carrosserieId;
        private String carrosserieLibelle;
        private Long categorieTransportId;
        private String immatriculation;
        private String immatriculationProvisoire;
        private String carburant;
        private String puissanceFiscale;
        private String nombrePlaces;
        private String sousClasse;
        private String ptc;
        private LocalDate datePremiereCirculation;
        private LocalDate dateExpirationCarteGrise;
        private LocalDate dateEffet;
        private LocalDate dateEcheance;
        private String crm;
        private String numeroAttestation;
        private Boolean remorque;
        private BigDecimal coefficientProrata;
        private BigDecimal valeurVenale;
        private BigDecimal valeurNeuf;
        private BigDecimal valeurGlace;
        private Boolean organismeCredit;
        private String nomOrganismeCredit;
        private BigDecimal montantCredit;
        private LocalDate dateFinCredit;
    }

    @Data
    public static class RemorqueInput {
        private Long usageId;
        private Long marqueId;
        private String marqueLibelle;
        private String immatriculation;
        private String ptc;
        private LocalDate dateMiseEnCirculation;
        private LocalDate dateEffet;
        private LocalDate dateEcheance;
        private String crm;
        private String numeroAttestation;
        private BigDecimal coefficientProrata;
        private BigDecimal valeurAssuree;
    }

    @Data
    public static class GarantieInput {
        @NotNull
        private Long garantieId;
        private Long ligneGrilleTarifaireId;
        private Long clientId;
        private Integer vehiculeIndex;
        private Integer remorqueIndex;
        private String modeSelectionne;
        private String sourceValeurSelectionnee;
        private Long formuleGarantiePersonneId;
        private BigDecimal valeurVenale;
        private BigDecimal valeurNeuf;
        private BigDecimal valeurGlace;
        private BigDecimal valeurAssuree;
        private String formule;
        private BigDecimal montantDeces;
        private BigDecimal montantInvalidite;
        private BigDecimal montantFraisMedicaux;
        private BigDecimal montantFraisHospitalisation;
        private BigDecimal montantFraisFuneraires;
        private BigDecimal montantFraisChirurgie;
        private BigDecimal accessoire;
        private BigDecimal capital;
        private BigDecimal taux;
        private BigDecimal prime;
        private BigDecimal tauxFranchise;
        private BigDecimal franchiseMinimale;
    }

    @Data
    public static class QuittanceInput {
        @NotNull
        private CategorieQuittance categorie;
        private Integer ordre;
        private Boolean globale;
        private BigDecimal primeNette;
        private BigDecimal taxe;
        private BigDecimal taxeParafiscale;
        private BigDecimal accessoire;
        private BigDecimal cnpac;
        private BigDecimal primeTotale;
    }

}
