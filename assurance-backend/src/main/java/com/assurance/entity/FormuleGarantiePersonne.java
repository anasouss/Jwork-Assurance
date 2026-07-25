package com.assurance.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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

@Entity
@Table(name = "formules_garantie_personne", indexes = {
        @Index(name = "idx_formule_personne_grille", columnList = "grille_tarifaire_id"),
        @Index(name = "idx_formule_personne_garantie", columnList = "garantie_id"),
        @Index(name = "idx_formule_personne_usage", columnList = "usage_id")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FormuleGarantiePersonne extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "grille_tarifaire_id", nullable = false)
    private GrilleTarifaire grilleTarifaire;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "garantie_id", nullable = false)
    private Garantie garantie;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usage_id")
    private Usage usage;

    @Column(nullable = false, length = 80)
    private String formule;

    @Column(name = "montant_deces", precision = 14, scale = 2)
    private BigDecimal montantDeces;

    @Column(name = "montant_invalidite", precision = 14, scale = 2)
    private BigDecimal montantInvalidite;

    @Column(name = "montant_frais_medicaux", precision = 14, scale = 2)
    private BigDecimal montantFraisMedicaux;

    @Column(name = "montant_frais_hospitalisation", precision = 14, scale = 2)
    private BigDecimal montantFraisHospitalisation;

    @Column(name = "montant_frais_funeraires", precision = 14, scale = 2)
    private BigDecimal montantFraisFuneraires;

    @Column(name = "montant_frais_chirurgie", precision = 14, scale = 2)
    private BigDecimal montantFraisChirurgie;

    @Column(name = "prime_nette", precision = 14, scale = 2)
    private BigDecimal primeNette;

    @Column(precision = 14, scale = 2)
    private BigDecimal accessoire;

    @Column(name = "ordre_affichage")
    private Integer ordreAffichage;

    @Builder.Default
    @Column(nullable = false)
    private Boolean actif = true;
}
