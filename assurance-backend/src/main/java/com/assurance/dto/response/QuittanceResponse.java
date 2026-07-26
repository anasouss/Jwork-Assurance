package com.assurance.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
@Builder
public class QuittanceResponse {
    private Long id;
    private Long contratId;
    private String numeroContrat;
    private Long mouvementContratId;
    private String codeMouvement;
    private String typeImpactMouvement;
    private Long elementFacturableId;
    private String numeroQuittance;
    private String type;
    private String categorie;
    private Boolean globale;
    private LocalDate dateDebut;
    private LocalDate dateFin;
    private BigDecimal primeNette;
    private BigDecimal taxe;
    private BigDecimal taxeParafiscale;
    private BigDecimal accessoire;
    private BigDecimal cnpac;
    private BigDecimal primeTotale;
    private List<Ligne> lignes;
    private List<GarantieLigne> garanties;
    private List<TargetSummary> targetSummaries;

    @Data
    @Builder
    public static class Ligne {
        private String categorie;
        private Integer ordre;
        private Boolean globale;
        private BigDecimal primeNette;
        private BigDecimal taxe;
        private BigDecimal taxeParafiscale;
        private BigDecimal accessoire;
        private BigDecimal cnpac;
        private BigDecimal primeTotale;
    }

    @Data
    @Builder
    public static class GarantieLigne {
        private Long garantieId;
        private String code;
        private String libelle;
        private String typeGarantie;
        private Integer vehiculeIndex;
        private Integer remorqueIndex;
        private Long ligneGrilleTarifaireId;
        private String modeSelectionne;
        private String sourceValeurSelectionnee;
        private Long formuleGarantiePersonneId;
        private BigDecimal capital;
        private BigDecimal valeurVenale;
        private BigDecimal valeurNeuf;
        private BigDecimal valeurGlace;
        private BigDecimal taux;
        private BigDecimal primeNette;
        private BigDecimal tauxFranchise;
        private BigDecimal franchiseMinimale;
    }

    @Data
    @Builder
    public static class TargetSummary {
        private String kind;
        private Integer vehiculeIndex;
        private Integer remorqueIndex;
        private BigDecimal primeNette;
        private BigDecimal primeNetteHorsEvcat;
        private BigDecimal automobilePrimeNette;
        private BigDecimal corporelPrimeNette;
        private BigDecimal evcatPrimeNette;
        private BigDecimal taxe;
        private BigDecimal taxeParafiscale;
        private BigDecimal accessoire;
        private BigDecimal cnpac;
        private BigDecimal primeTotale;
    }
}
