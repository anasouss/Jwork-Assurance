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
import java.time.LocalDate;

@Entity
@Table(name = "codes_promo_assistance", indexes = {
        @Index(name = "idx_promo_assistance_produit_code", columnList = "produit_assistance_id,code"),
        @Index(name = "idx_promo_assistance_dates", columnList = "date_debut,date_fin")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CodePromoAssistance extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "produit_assistance_id", nullable = false)
    private ProduitAssistance produitAssistance;

    @Column(nullable = false, length = 60)
    private String code;

    @Column(name = "taux_reduction", nullable = false, precision = 7, scale = 4)
    private BigDecimal tauxReduction;

    @Column(name = "date_debut", nullable = false)
    private LocalDate dateDebut;

    @Column(name = "date_fin")
    private LocalDate dateFin;

    @Builder.Default
    @Column(nullable = false)
    private Boolean actif = true;
}
