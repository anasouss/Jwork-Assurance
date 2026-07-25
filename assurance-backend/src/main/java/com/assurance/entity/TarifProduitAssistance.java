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
@Table(name = "tarifs_produit_assistance", indexes = {
        @Index(name = "idx_tarif_assistance_produit", columnList = "produit_assistance_id"),
        @Index(name = "idx_tarif_assistance_dates", columnList = "date_debut,date_fin")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TarifProduitAssistance extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "produit_assistance_id", nullable = false)
    private ProduitAssistance produitAssistance;

    @Column(name = "date_debut", nullable = false)
    private LocalDate dateDebut;

    @Column(name = "date_fin")
    private LocalDate dateFin;

    @Column(name = "montant_ht", nullable = false, precision = 14, scale = 2)
    private BigDecimal montantHt;

    @Column(name = "montant_ttc", nullable = false, precision = 14, scale = 2)
    private BigDecimal montantTtc;

    @Builder.Default
    @Column(nullable = false)
    private Boolean actif = true;
}
