package com.assurance.entity;

import com.assurance.enums.StatutAgence;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;

@Entity
@Table(name = "agences", indexes = {
        @Index(name = "idx_agence_statut", columnList = "statut")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Agence extends BaseEntity {

    @Column(nullable = false, unique = true, length = 50)
    private String code;

    @Column(nullable = false, length = 150)
    private String nom;

    @Column(length = 255)
    private String adresse;

    @Column(length = 100)
    private String ville;

    @Column(length = 50)
    private String telephone;

    @Column(length = 50)
    private String fax;

    @Column(length = 150)
    private String email;

    @Column(name = "identifiant_fiscal", length = 80)
    private String identifiantFiscal;

    @Column(length = 80)
    private String patente;

    @Column(length = 80)
    private String ice;

    @Column(name = "numero_agrement", length = 120)
    private String numeroAgrement;

    @Column(name = "date_agrement")
    private LocalDate dateAgrement;

    @Column(length = 120)
    private String banque;

    @Column(length = 120)
    private String rib;

    @Column(name = "logo_chemin_stockage", length = 500)
    private String logoCheminStockage;

    @Column(name = "logo_type_mime", length = 50)
    private String logoTypeMime;

    @Column(name = "logo_nom_fichier", length = 255)
    private String logoNomFichier;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    @Builder.Default
    private StatutAgence statut = StatutAgence.ACTIVE;
}
