package com.assurance.entity;

import com.assurance.enums.ModeAffectationQuittance;
import com.assurance.enums.ModeCalculCommission;
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

    @Column(name = "tolerance_ecart", nullable = false, precision = 14, scale = 2)
    private BigDecimal toleranceEcart;

    @Column(name = "date_debut", nullable = false)
    private LocalDate dateDebut;

    @Column(name = "date_fin")
    private LocalDate dateFin;

    @Builder.Default
    @Column(nullable = false)
    private Boolean actif = true;
}
