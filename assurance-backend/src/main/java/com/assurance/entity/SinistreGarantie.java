package com.assurance.entity;

import com.assurance.enums.DecisionCouvertureSinistre;
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

@Entity
@Table(name = "sinistre_garanties",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_sinistre_garantie",
                columnNames = {"sinistre_id", "garantie_id"}
        ),
        indexes = @Index(name = "idx_sinistre_garantie_sinistre", columnList = "sinistre_id"))
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SinistreGarantie extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sinistre_id", nullable = false)
    private Sinistre sinistre;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "garantie_id", nullable = false)
    private Garantie garantie;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "mouvement_garantie_source_id")
    private MouvementGarantie mouvementGarantieSource;

    @Builder.Default
    @Column(nullable = false)
    private boolean impliquee = false;

    @Column(name = "snapshot_code", nullable = false, length = 40)
    private String snapshotCode;

    @Column(name = "snapshot_libelle", nullable = false, length = 180)
    private String snapshotLibelle;

    @Column(name = "snapshot_capital", precision = 19, scale = 2)
    private BigDecimal snapshotCapital;

    @Column(name = "snapshot_prime", precision = 19, scale = 2)
    private BigDecimal snapshotPrime;

    @Column(name = "snapshot_taux", precision = 14, scale = 4)
    private BigDecimal snapshotTaux;

    @Column(name = "snapshot_taux_franchise", precision = 14, scale = 4)
    private BigDecimal snapshotTauxFranchise;

    @Column(name = "snapshot_franchise_minimale", precision = 19, scale = 2)
    private BigDecimal snapshotFranchiseMinimale;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(name = "decision_couverture", nullable = false, length = 30)
    private DecisionCouvertureSinistre decisionCouverture = DecisionCouvertureSinistre.A_ETUDIER;

    @Column(name = "franchise_appliquee", precision = 19, scale = 2)
    private BigDecimal franchiseAppliquee;

    @Column(name = "montant_indemnisable", precision = 19, scale = 2)
    private BigDecimal montantIndemnisable;
}
