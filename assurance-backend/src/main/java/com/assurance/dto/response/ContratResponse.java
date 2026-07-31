package com.assurance.dto.response;

import com.assurance.enums.Fractionnement;
import com.assurance.enums.ModeSaisieGarantieContrat;
import com.assurance.enums.StatutContrat;
import com.assurance.enums.TypeContrat;
import com.assurance.enums.ModeFacturationContrat;
import com.assurance.enums.TypePayeurPrime;
import com.assurance.enums.ModeTermeRenouvellement;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class ContratResponse {
    private Long id;
    private String numeroContrat;
    private String numeroDevis;
    private String numeroDossier;
    private String numeroPolice;
    private LocalDateTime createdAt;
    private TypeContrat typeContrat;
    private StatutContrat statut;
    private Long agenceId;
    private Long compagnieAssuranceId;
    private Long conventionId;
    private Long contratOrigineId;
    private Boolean renouvele;
    private ModeTermeRenouvellement modeTermeRenouvellement;
    private Boolean renouvellementTermeCompagnieEligible;
    private Long usageId;
    private String usageCode;
    private String usageLibelle;
    private String groupeUsageAttestationCode;
    private String groupeUsageAttestationLibelle;
    private Boolean consommeAttestation;
    private Long grilleTarifaireId;
    private LocalDate dateEffet;
    private LocalDate dateEcheance;
    private String numeroAttestation;
    private String echeance;
    private String typeRenouvellement;
    private String modePaiement;
    private String modeReglement;
    private String numeroBonCommande;
    private BigDecimal montantBulletin;
    private TypePayeurPrime typePayeurPrime;
    private Long payeurPrimeClientId;
    private String payeurPrimeNom;
    private Long groupeFacturationId;
    private String groupeFacturationNom;
    private ModeFacturationContrat modeFacturation;
    private String periodicite;
    private Fractionnement fractionnement;
    private BigDecimal tauxRc;
    private ModeSaisieGarantieContrat modeSaisieGaranties;
    private Boolean saisiePrimeNette;
    private Integer nombreVehicules;
    private Integer nombreRemorques;
    private Boolean brouillon;
    private Boolean prospection;
    private Boolean assistance;
    private Boolean crmPartage;
    private String crmPartageValeur;
    private List<ClientLink> clients;
    private List<VehiculeView> vehicules;
    private List<RemorqueView> remorques;
    private List<GarantieView> garanties;
    private List<AssistanceContratResponse> assistances;
    private List<MouvementView> mouvements;
    private List<AvenantDraftSummaryResponse> avenantDrafts;
    private List<ElementFacturableView> elementsFacturables;
    private List<QuittanceResponse.TargetSummary> targetSummaries;
    private QuittanceResponse quittanceGenerale;
    @Data
    @Builder
    public static class ClientLink {
        private Long clientId;
        private String nomAffichage;
        private String role;
        private boolean principalPourRole;
        private ClientResponse client;
    }

    @Data
    @Builder
    public static class VehiculeView {
        private Long vehiculeId;
        private String typeVehicule;
        private Long usageId;
        private String usageCode;
        private String usageLibelle;
        private String groupeUsageAttestationCode;
        private Boolean consommeAttestation;
        private String immatriculation;
        private String numeroAttestation;
        private Boolean remorque;
        private Long marqueId;
        private String marque;
        private Long carrosserieId;
        private String carrosserie;
        private Long categorieTransportId;
        private String categorieTransportCode;
        private String categorieTransportLibelle;
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
        private Long remorqueId;
        private Long usageId;
        private String usageCode;
        private String usageLibelle;
        private String groupeUsageAttestationCode;
        private Boolean consommeAttestation;
        private String immatriculation;
        private String numeroAttestation;
        private Long marqueId;
        private String marque;
        private String ptc;
        private LocalDate dateMiseEnCirculation;
        private LocalDate dateEffet;
        private LocalDate dateEcheance;
        private String crm;
        private BigDecimal coefficientProrata;
        private BigDecimal valeurAssuree;
    }

    @Data
    @Builder
    public static class GarantieView {
        private Long contratGarantieId;
        private Long garantieId;
        private String code;
        private String libelle;
        private String typeGarantie;
        private Long clientId;
        private Long vehiculeId;
        private Long remorqueId;
        private Long ligneGrilleTarifaireId;
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
    @Builder
    public static class MouvementView {
        private Long id;
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
        private Long id;
        private Long mouvementContratId;
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
