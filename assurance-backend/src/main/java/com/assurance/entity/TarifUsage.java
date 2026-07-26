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
@Table(name = "tarifs_usage", indexes = {
        @Index(name = "idx_tarif_usage", columnList = "usage_id"),
        @Index(name = "idx_tarif_usage_categorie_transport", columnList = "categorie_transport_id"),
        @Index(name = "idx_tarif_usage_carburant", columnList = "carburant_id")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TarifUsage extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usage_id", nullable = false)
    private Usage usage;

    @Column(name = "puissance_fiscale_min", precision = 10, scale = 2)
    private BigDecimal puissanceFiscaleMin;

    @Column(name = "puissance_fiscale_max", precision = 10, scale = 2)
    private BigDecimal puissanceFiscaleMax;

    @Column(name = "nombre_places_min", precision = 10, scale = 2)
    private BigDecimal nombrePlacesMin;

    @Column(name = "nombre_places_max", precision = 10, scale = 2)
    private BigDecimal nombrePlacesMax;

    @Column(name = "ptc_min", precision = 10, scale = 2)
    private BigDecimal ptcMin;

    @Column(name = "ptc_max", precision = 10, scale = 2)
    private BigDecimal ptcMax;

    @Column(name = "sous_classe", length = 80)
    private String sousClasse;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "categorie_transport_id")
    private CategorieTransport categorieTransport;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "carburant_id")
    private Carburant carburant;

    @Column(name = "prime_nette", precision = 14, scale = 2)
    private BigDecimal primeNette;

    @Column(name = "prime_par_place", precision = 14, scale = 2)
    private BigDecimal primeParPlace;

    @Builder.Default
    @Column(nullable = false)
    private Boolean actif = true;
}
