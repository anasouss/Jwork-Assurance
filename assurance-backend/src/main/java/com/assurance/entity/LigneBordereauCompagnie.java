package com.assurance.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToOne;
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
@Table(
        name = "lignes_bordereaux_compagnies",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_ligne_bordereau_source",
                columnNames = {"bordereau_id", "affectation_source_id"}
        ),
        indexes = {
                @Index(name = "idx_ligne_bordereau_bordereau", columnList = "bordereau_id"),
                @Index(name = "idx_ligne_bordereau_source", columnList = "affectation_source_id")
        }
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LigneBordereauCompagnie extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "bordereau_id", nullable = false)
    private BordereauCompagnie bordereau;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "affectation_source_id", nullable = false)
    private AffectationQuittanceCompagnie affectationSource;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "affectation_reservee_id", unique = true)
    private AffectationQuittanceCompagnie affectationReservee;

    @Column(nullable = false)
    private Integer ordre;

    @Column(name = "numero_quittance_compagnie", nullable = false, length = 100)
    private String numeroQuittanceCompagnie;

    @Column(name = "numero_police", length = 80)
    private String numeroPolice;

    @Column(name = "numero_dossier", length = 80)
    private String numeroDossier;

    @Column(length = 180)
    private String mouvement;

    @Column(name = "date_effet", nullable = false)
    private LocalDate dateEffet;

    @Column(name = "date_echeance")
    private LocalDate dateEcheance;

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

    @Column(name = "montant_retenue", nullable = false, precision = 16, scale = 2)
    private BigDecimal montantRetenue;

    @Column(name = "net_compagnie", nullable = false, precision = 16, scale = 2)
    private BigDecimal netCompagnie;
}
