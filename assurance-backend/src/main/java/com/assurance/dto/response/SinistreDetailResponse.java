package com.assurance.dto.response;

import com.assurance.enums.DecisionCouvertureSinistre;
import com.assurance.enums.NatureSinistre;
import com.assurance.enums.StatutDocumentSinistre;
import com.assurance.enums.StatutMissionExpertise;
import com.assurance.enums.StatutSinistre;
import com.assurance.enums.TypeDocumentSinistre;
import com.assurance.enums.TypeEvenementSinistre;
import com.assurance.enums.TypeOperationSinistre;
import com.assurance.enums.TypePartieSinistre;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

@Data
@Builder
public class SinistreDetailResponse {
    private Long id;
    private long version;
    private String numeroSinistre;
    private String referenceCompagnie;
    private StatutSinistre statut;
    private NatureSinistre nature;
    private LocalDate dateSinistre;
    private LocalTime heureSinistre;
    private LocalDate dateDeclaration;
    private LocalDate dateTransmission;
    private LocalDate dateCloture;
    private Long villeId;
    private String ville;
    private String lieu;
    private String circonstances;
    private String numeroPv;
    private BigDecimal tauxResponsabilite;
    private String notes;
    private Long gestionnaireId;
    private String gestionnaire;
    private Couverture couverture;
    private Totaux totaux;
    private List<Garantie> garanties;
    private List<Partie> parties;
    private List<Document> documents;
    private List<Mission> missionsExpertise;
    private List<Provision> provisions;
    private List<Operation> operations;
    private List<Evenement> evenements;

    @Data
    @Builder
    public static class Couverture {
        private Long contratId;
        private Long mouvementId;
        private String numeroMouvement;
        private String numeroDossier;
        private String numeroPolice;
        private String compagnie;
        private String clientCode;
        private String assure;
        private LocalDate dateEffet;
        private LocalDate dateEcheance;
        private Long vehiculeId;
        private String immatriculation;
        private String numeroAttestation;
        private String marque;
        private String usageCode;
        private String usageLibelle;
    }

    @Data
    @Builder
    public static class Totaux {
        private BigDecimal provisionCourante;
        private BigDecimal totalRegle;
        private BigDecimal totalFrais;
        private BigDecimal totalRecours;
        private BigDecimal resteARegler;
    }

    @Data
    @Builder
    public static class Garantie {
        private Long id;
        private Long garantieId;
        private String code;
        private String libelle;
        private boolean impliquee;
        private BigDecimal capital;
        private BigDecimal prime;
        private BigDecimal taux;
        private BigDecimal tauxFranchise;
        private BigDecimal franchiseMinimale;
        private DecisionCouvertureSinistre decisionCouverture;
        private BigDecimal franchiseAppliquee;
        private BigDecimal montantIndemnisable;
    }

    @Data
    @Builder
    public static class Partie {
        private Long id;
        private TypePartieSinistre type;
        private String nom;
        private String telephone;
        private String cin;
        private String numeroPermis;
        private String immatriculation;
        private String compagnieAdverse;
        private String numeroPoliceAdverse;
        private String notes;
    }

    @Data
    @Builder
    public static class Document {
        private Long id;
        private TypeDocumentSinistre type;
        private StatutDocumentSinistre statut;
        private String nomFichier;
        private String contentType;
        private long tailleOctets;
        private String commentaire;
        private String deposePar;
        private String validePar;
        private LocalDateTime createdAt;
        private LocalDateTime dateValidation;
    }

    @Data
    @Builder
    public static class Mission {
        private Long id;
        private Long expertId;
        private String expert;
        private Long garageId;
        private String garage;
        private String referenceMission;
        private LocalDate dateMission;
        private LocalDate dateRapport;
        private BigDecimal montantEstime;
        private BigDecimal montantAccepte;
        private StatutMissionExpertise statut;
        private String notes;
    }

    @Data
    @Builder
    public static class Provision {
        private Long id;
        private LocalDate dateProvision;
        private BigDecimal montant;
        private String motif;
        private String saisiePar;
        private LocalDateTime createdAt;
    }

    @Data
    @Builder
    public static class Operation {
        private Long id;
        private TypeOperationSinistre type;
        private LocalDate dateOperation;
        private BigDecimal montant;
        private String reference;
        private String beneficiaire;
        private String modeReglement;
        private String notes;
        private Long operationAnnuleeId;
        private String saisiePar;
        private LocalDateTime createdAt;
    }

    @Data
    @Builder
    public static class Evenement {
        private Long id;
        private TypeEvenementSinistre type;
        private String description;
        private StatutSinistre ancienStatut;
        private StatutSinistre nouveauStatut;
        private String utilisateur;
        private LocalDateTime createdAt;
    }
}
