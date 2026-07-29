package com.assurance.dto.response;

import com.assurance.enums.NatureAffectationQuittance;
import com.assurance.enums.SourceAffectationQuittance;
import com.assurance.enums.StatutAffectationQuittance;
import com.assurance.enums.TypeContrat;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
@Builder
public class AffectationQuittanceResponse {
    private Long quittanceId;
    private Long contratId;
    private Long mouvementId;
    private String dossier;
    private String produit;
    private TypeContrat typeContrat;
    private String mouvement;
    private NatureAffectationQuittance nature;
    private String souscripteur;
    private String police;
    private Long compagnieId;
    private String compagnie;
    private LocalDate dateEffet;
    private LocalDate dateEcheance;
    private BigDecimal primeNette;
    private BigDecimal montantTaxes;
    private BigDecimal accessoires;
    private BigDecimal montantTtc;
    private BigDecimal montantAffecte;
    private BigDecimal ecart;
    private String numerosQuittanceCompagnie;
    private BigDecimal commissionCalculee;
    private BigDecimal retenueCalculee;
    private BigDecimal netCompagnieCalcule;
    private Boolean avecRetenue;
    private StatutAffectationQuittance statutAffectation;
    private RegleAffectationQuittanceResponse regle;
    private List<Ligne> lignes;

    @Data
    @Builder
    public static class Ligne {
        private Long id;
        private String numeroQuittanceCompagnie;
        private SourceAffectationQuittance source;
        private LocalDate dateEffet;
        private LocalDate dateEcheance;
        private String acteSource;
        private String categorieSource;
        private String statutSource;
        private String fichierSource;
        private BigDecimal primeNette;
        private BigDecimal montantTaxes;
        private BigDecimal accessoires;
        private BigDecimal montantTtc;
        private BigDecimal commissionNette;
        private Boolean avecRetenue;
        private BigDecimal tauxRetenue;
        private BigDecimal montantRetenue;
        private BigDecimal netCompagnie;
    }
}
