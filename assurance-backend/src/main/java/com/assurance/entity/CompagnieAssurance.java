package com.assurance.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "compagnies_assurance", indexes = {
        @Index(name = "idx_compagnie_actif", columnList = "actif")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CompagnieAssurance extends BaseEntity {

    @Column(nullable = false, unique = true, length = 80)
    private String code;

    @Column(nullable = false, length = 150)
    private String nom;

    @Column(length = 255)
    private String adresse;

    @Column(length = 100)
    private String ville;

    @Column(length = 150)
    private String email;

    @Column(length = 50)
    private String telephone;

    @Column(length = 100)
    private String rc;

    @Column(length = 100)
    private String ice;

    @Column(name = "prefixe_attestation", length = 40)
    private String prefixeAttestation;

    @Column(name = "prefixe_carte_verte", length = 40)
    private String prefixeCarteVerte;

    @Column(name = "prefixe_dossier", length = 10, unique = true)
    private String prefixeDossier;

    @Builder.Default
    @Column(name = "ordre_affichage", nullable = false)
    private Integer ordreAffichage = 100;

    @Builder.Default
    @Column(nullable = false)
    private Boolean actif = true;
}
