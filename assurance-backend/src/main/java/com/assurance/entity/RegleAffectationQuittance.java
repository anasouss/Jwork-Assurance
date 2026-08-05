package com.assurance.entity;

import com.assurance.enums.ModeAffectationQuittance;
import com.assurance.enums.ModeCalculCommission;
import com.assurance.enums.ModeVentilationQuittance;
import com.assurance.enums.TypeContrat;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "regles_affectation_quittance", indexes = {
        @Index(name = "idx_regle_affectation_agence", columnList = "agence_id"),
        @Index(name = "idx_regle_affectation_compagnie", columnList = "compagnie_assurance_id"),
        @Index(name = "idx_regle_affectation_periode", columnList = "date_debut,date_fin")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RegleAffectationQuittance extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agence_id", nullable = false)
    private Agence agence;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "compagnie_assurance_id", nullable = false)
    private CompagnieAssurance compagnieAssurance;

    @Enumerated(EnumType.STRING)
    @Column(name = "type_contrat", nullable = false, length = 30)
    private TypeContrat typeContrat;

    @Enumerated(EnumType.STRING)
    @Column(name = "mode_affectation", nullable = false, length = 30)
    private ModeAffectationQuittance modeAffectation;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(name = "mode_ventilation", nullable = false, length = 30)
    private ModeVentilationQuittance modeVentilation = ModeVentilationQuittance.GLOBALE;

    @Enumerated(EnumType.STRING)
    @Column(name = "mode_calcul_commission", nullable = false, length = 40)
    private ModeCalculCommission modeCalculCommission;

    @Column(name = "taux_commission_automobile", nullable = false, precision = 9, scale = 4)
    private BigDecimal tauxCommissionAutomobile;

    @Column(name = "taux_commission_evcat", nullable = false, precision = 9, scale = 4)
    private BigDecimal tauxCommissionEvcat;

    @Column(name = "taux_commission_corporel", nullable = false, precision = 9, scale = 4)
    private BigDecimal tauxCommissionCorporel;

    @Column(name = "taux_tva_incluse_commission", nullable = false, precision = 9, scale = 4)
    private BigDecimal tauxTvaIncluseCommission;

    @Builder.Default
    @Column(name = "retenue_par_defaut", nullable = false)
    private Boolean retenueParDefaut = false;

    @Column(name = "taux_retenue", nullable = false, precision = 9, scale = 4)
    private BigDecimal tauxRetenue;

    @Builder.Default
    @Column(name = "seuil_avertissement_ecart", nullable = false, precision = 15, scale = 2)
    private BigDecimal seuilAvertissementEcart = new BigDecimal("0.01");

    @Builder.Default
    @Column(
            name = "marge_manquante_maximale",
            nullable = false,
            precision = 15,
            scale = 2,
            columnDefinition = "DECIMAL(15,2) DEFAULT 20.00"
    )
    private BigDecimal margeManquanteMaximale = new BigDecimal("20.00");

    @Builder.Default
    @Column(
            name = "seuil_blocage_ecart",
            nullable = false,
            precision = 15,
            scale = 2
    )
    private BigDecimal margeDepassementMaximale = new BigDecimal("50.00");

    @Column(name = "date_debut", nullable = false)
    private LocalDate dateDebut;

    @Column(name = "date_fin")
    private LocalDate dateFin;

    @Column(name = "excel_feuille", length = 120)
    private String excelFeuille;

    @Builder.Default
    @Column(name = "excel_ligne_entete", nullable = false)
    private Integer excelLigneEntete = 1;

    @Column(name = "excel_colonne_numero_police", length = 500)
    private String excelColonneNumeroPolice;

    @Column(name = "excel_colonne_numero_quittance", length = 500)
    private String excelColonneNumeroQuittance;

    @Column(name = "excel_colonne_date_effet", length = 500)
    private String excelColonneDateEffet;

    @Column(name = "excel_colonne_date_echeance", length = 500)
    private String excelColonneDateEcheance;

    @Column(name = "excel_colonne_prime_nette", length = 500)
    private String excelColonnePrimeNette;

    @Column(name = "excel_colonne_taxes", length = 500)
    private String excelColonneTaxes;

    @Column(name = "excel_colonne_accessoires", length = 500)
    private String excelColonneAccessoires;

    @Column(name = "excel_colonne_montant_ttc", length = 500)
    private String excelColonneMontantTtc;

    @Column(name = "excel_colonne_commission_nette", length = 500)
    private String excelColonneCommissionNette;

    @Column(name = "excel_colonne_net_compagnie", length = 500)
    private String excelColonneNetCompagnie;

    @Column(name = "excel_colonne_acte", length = 500)
    private String excelColonneActe;

    @Column(name = "excel_colonne_categorie", length = 500)
    private String excelColonneCategorie;

    @Column(name = "excel_colonne_statut", length = 500)
    private String excelColonneStatut;

    @Builder.Default
    @Column(nullable = false)
    private Boolean actif = true;
}
