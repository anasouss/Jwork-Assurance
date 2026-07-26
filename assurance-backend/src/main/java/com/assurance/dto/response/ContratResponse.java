package com.assurance.dto.response;

import com.assurance.enums.Fractionnement;
import com.assurance.enums.ModeSaisieGarantieContrat;
import com.assurance.enums.StatutContrat;
import com.assurance.enums.TypeContrat;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
@Builder
public class ContratResponse {
    private String id;
    private String numeroContrat;
    private String numeroPolice;
    private TypeContrat typeContrat;
    private StatutContrat statut;
    private String agenceId;
    private String compagnieAssuranceId;
    private String conventionId;
    private String contratOrigineId;
    private Boolean renouvele;
    private String usageId;
    private String usageCode;
    private String usageLibelle;
    private String groupeUsageAttestationCode;
    private String groupeUsageAttestationLibelle;
    private Boolean consommeAttestation;
    private String grilleTarifaireId;
    private LocalDate dateEffet;
    private LocalDate dateEcheance;
    private String numeroAttestation;
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
    private List<ClientLink> clients;
    private List<VehiculeView> vehicules;
    private List<RemorqueView> remorques;
    private List<GarantieView> garanties;
    private List<MouvementView> mouvements;
    private List<ElementFacturableView> elementsFacturables;

    @Data
    @Builder
    public static class ClientLink {
        private String clientId;
        private String nomAffichage;
        private String role;
        private boolean principalPourRole;
    }

    @Data
    @Builder
    public static class VehiculeView {
        private String vehiculeId;
        private String typeVehicule;
        private String usageId;
        private String usageCode;
        private String usageLibelle;
        private String groupeUsageAttestationCode;
        private Boolean consommeAttestation;
        private String immatriculation;
        private String numeroAttestation;
        private Boolean remorque;
        private String marqueId;
        private String marque;
        private String carrosserieId;
        private String carrosserie;
        private String categorieTransportId;
        private String categorieTransportCode;
        private String categorieTransportLibelle;
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
    @Builder
    public static class RemorqueView {
        private String remorqueId;
        private String usageId;
        private String usageCode;
        private String usageLibelle;
        private String groupeUsageAttestationCode;
        private Boolean consommeAttestation;
        private String immatriculation;
        private String numeroAttestation;
        private String marqueId;
        private String marque;
        private String ptc;
        private BigDecimal coefficientProrata;
        private BigDecimal valeurAssuree;
    }

    @Data
    @Builder
    public static class GarantieView {
        private String contratGarantieId;
        private String garantieId;
        private String code;
        private String libelle;
        private String typeGarantie;
        private String clientId;
        private String vehiculeId;
        private String remorqueId;
        private String ligneGrilleTarifaireId;
        private String modeSelectionne;
        private String sourceValeurSelectionnee;
        private String formuleGarantiePersonneId;
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
    @Builder
    public static class MouvementView {
        private String id;
        private String code;
        private String libelle;
        private String categorie;
        private String statut;
        private String numeroMouvement;
        private LocalDate dateEffet;
        private LocalDate dateEcheance;
        private BigDecimal primeNette;
        private BigDecimal taxe;
        private BigDecimal taxeParafiscale;
        private BigDecimal accessoire;
        private BigDecimal cnpac;
        private BigDecimal primeTotale;
    }

    @Data
    @Builder
    public static class ElementFacturableView {
        private String id;
        private String mouvementContratId;
        private String nature;
        private String statut;
        private String referenceSource;
        private String libelle;
        private LocalDate dateDebut;
        private LocalDate dateFin;
        private BigDecimal primeNette;
        private BigDecimal taxe;
        private BigDecimal taxeParafiscale;
        private BigDecimal accessoire;
        private BigDecimal cnpac;
        private BigDecimal primeTotale;
    }
}
