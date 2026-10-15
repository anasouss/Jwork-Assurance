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
@Table(name = "lignes_tarification_assistance", indexes = {
        @Index(name = "idx_ligne_tarification_assistance", columnList = "assistance_contrat_id"),
        @Index(name = "idx_ligne_tarification_assure", columnList = "assure_id")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LigneTarificationAssistance extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assistance_contrat_id", nullable = false)
    private AssistanceContrat assistanceContrat;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assure_id", nullable = false)
    private Client assure;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tarif_produit_assistance_id", nullable = false)
    private TarifProduitAssistance tarifProduitAssistance;

    @Column(nullable = false)
    private Integer age;

    @Column(name = "coefficient_duree", nullable = false, precision = 7, scale = 2)
    private BigDecimal coefficientDuree;

    @Column(name = "montant_base_ht", nullable = false, precision = 14, scale = 2)
    private BigDecimal montantBaseHt;

    @Column(name = "montant_base_ttc", nullable = false, precision = 14, scale = 2)
    private BigDecimal montantBaseTtc;

    @Column(name = "montant_reduction", nullable = false, precision = 14, scale = 2)
    private BigDecimal montantReduction;

    @Column(name = "prime_nette", nullable = false, precision = 14, scale = 2)
    private BigDecimal primeNette;

    @Column(name = "prime_totale", nullable = false, precision = 14, scale = 2)
    private BigDecimal primeTotale;
}
