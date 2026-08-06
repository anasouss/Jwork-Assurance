package com.assurance.entity;

import com.assurance.enums.ModeTarificationGarantie;
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
@Table(name = "lignes_grille_tarifaire", indexes = {
        @Index(name = "idx_ligne_grille", columnList = "grille_tarifaire_id"),
        @Index(name = "idx_ligne_garantie", columnList = "garantie_id"),
        @Index(name = "idx_ligne_usage", columnList = "usage_id"),
        @Index(name = "idx_ligne_sous_classe", columnList = "sous_classe_id"),
        @Index(name = "idx_ligne_categorie_transport", columnList = "categorie_transport_id")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LigneGrilleTarifaire extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "grille_tarifaire_id", nullable = false)
    private GrilleTarifaire grilleTarifaire;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "garantie_id", nullable = false)
    private Garantie garantie;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usage_id")
    private Usage usage;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "categorie_transport_id")
    private CategorieTransport categorieTransport;

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

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sous_classe_id")
    private SousClasse sousClasse;

    @Column(length = 40)
    private String carburant;

    @Column(precision = 14, scale = 4)
    private BigDecimal taux;

    @Column(name = "taux_franchise", precision = 14, scale = 4)
    private BigDecimal tauxFranchise;

    @Column(name = "franchise_minimale", precision = 14, scale = 2)
    private BigDecimal franchiseMinimale;

    @Column(precision = 14, scale = 2)
    private BigDecimal prime;

    @Column(precision = 14, scale = 2)
    private BigDecimal capital;

    @Column(name = "libelle_option", length = 160)
    private String libelleOption;

    @Column(name = "ordre_affichage")
    private Integer ordreAffichage;

    @Enumerated(EnumType.STRING)
    @Column(name = "mode_tarification", length = 40)
    private ModeTarificationGarantie modeTarification;

    @Builder.Default
    @Column(nullable = false)
    private Boolean actif = true;
}
