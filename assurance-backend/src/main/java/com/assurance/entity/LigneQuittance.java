package com.assurance.entity;

import com.assurance.enums.CategorieQuittance;
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

@Entity
@Table(name = "lignes_quittance", indexes = {
        @Index(name = "idx_ligne_quittance_quittance", columnList = "quittance_id"),
        @Index(name = "idx_ligne_quittance_categorie", columnList = "categorie")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LigneQuittance extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "quittance_id", nullable = false)
    private Quittance quittance;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private CategorieQuittance categorie;

    @Column(nullable = false)
    private Integer ordre;

    @Builder.Default
    @Column(nullable = false)
    private Boolean globale = false;

    @Column(name = "prime_nette", precision = 14, scale = 2)
    private BigDecimal primeNette;

    @Column(precision = 14, scale = 2)
    private BigDecimal taxe;

    @Column(name = "taxe_parafiscale", precision = 14, scale = 2)
    private BigDecimal taxeParafiscale;

    @Column(precision = 14, scale = 2)
    private BigDecimal accessoire;

    @Column(precision = 14, scale = 2)
    private BigDecimal cnpac;

    @Column(name = "prime_totale", precision = 14, scale = 2)
    private BigDecimal primeTotale;
}
