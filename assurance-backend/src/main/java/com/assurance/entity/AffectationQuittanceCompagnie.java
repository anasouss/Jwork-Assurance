package com.assurance.entity;

import com.assurance.enums.CategorieQuittance;
import com.assurance.enums.SourceAffectationQuittance;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "affectations_quittance_compagnie",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_affectation_compagnie_numero",
                columnNames = {"agence_id", "compagnie_assurance_id", "numero_quittance_compagnie"}
        ),
        indexes = {
                @Index(name = "idx_affectation_quittance", columnList = "quittance_id"),
                @Index(name = "idx_affectation_agence", columnList = "agence_id"),
                @Index(name = "idx_affectation_numero", columnList = "numero_quittance_compagnie")
        })
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AffectationQuittanceCompagnie extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agence_id", nullable = false)
    private Agence agence;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "quittance_id", nullable = false)
    private Quittance quittance;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "compagnie_assurance_id", nullable = false)
    private CompagnieAssurance compagnieAssurance;

    @Column(name = "numero_quittance_compagnie", nullable = false, length = 100)
    private String numeroQuittanceCompagnie;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private SourceAffectationQuittance source;

    @Column(name = "date_effet", nullable = false)
    private LocalDate dateEffet;

    @Column(name = "date_echeance")
    private LocalDate dateEcheance;

    @Column(name = "acte_source", length = 180)
    private String acteSource;

    @Column(name = "categorie_source", length = 220)
    private String categorieSource;

    @Enumerated(EnumType.STRING)
    @Column(name = "categorie_quittance", length = 30)
    private CategorieQuittance categorieQuittance;

    @Column(name = "statut_source", length = 100)
    private String statutSource;

    @Column(name = "fichier_source", length = 255)
    private String fichierSource;

    @Column(name = "prime_nette", nullable = false, precision = 16, scale = 2)
    private BigDecimal primeNette;

    @Column(name = "montant_taxes", nullable = false, precision = 16, scale = 2)
    private BigDecimal montantTaxes;

    @Column(nullable = false, precision = 16, scale = 2)
    private BigDecimal accessoires;

    @Column(name = "montant_ttc", nullable = false, precision = 16, scale = 2)
    private BigDecimal montantTtc;

    @Column(name = "commission_nette", nullable = false, precision = 16, scale = 2)
    private BigDecimal commissionNette;

    @Builder.Default
    @Column(name = "avec_retenue", nullable = false)
    private Boolean avecRetenue = false;

    @Column(name = "taux_retenue", nullable = false, precision = 9, scale = 4)
    private BigDecimal tauxRetenue;

    @Column(name = "montant_retenue", nullable = false, precision = 16, scale = 2)
    private BigDecimal montantRetenue;

    @Column(name = "net_compagnie", nullable = false, precision = 16, scale = 2)
    private BigDecimal netCompagnie;

    @Column(name = "cree_par")
    private Long creePar;

    @Column(name = "modifie_par")
    private Long modifiePar;
}
