package com.assurance.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "usages")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Usage extends BaseEntity {

    @Column(nullable = false, unique = true, length = 80)
    private String code;

    @Column(nullable = false, length = 160)
    private String libelle;

    @Column(length = 500)
    private String criteria;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "groupe_usage_attestation_id")
    private GroupeUsageAttestation groupeUsageAttestation;

    @Builder.Default
    @Column(name = "consomme_attestation", nullable = false)
    private Boolean consommeAttestation = true;

    @Builder.Default
    @Column(name = "by_carburant_and_pf", nullable = false)
    private Boolean byCarburantAndPf = false;

    @Builder.Default
    @Column(name = "by_sous_classe", nullable = false)
    private Boolean bySousClasse = false;

    @Builder.Default
    @Column(name = "by_ptc", nullable = false)
    private Boolean byPtc = false;

    @Builder.Default
    @Column(name = "by_prime", nullable = false)
    private Boolean byPrime = false;

    @Builder.Default
    @Column(name = "by_categorie_transport", nullable = false)
    private Boolean byCategorieTransport = false;

    @Builder.Default
    @Column(name = "garanties_personne")
    private Boolean garantiesPersonne = false;

    @Builder.Default
    @Column(nullable = false)
    private Boolean actif = true;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "usage_carrosseries",
            joinColumns = @JoinColumn(name = "usage_id"),
            inverseJoinColumns = @JoinColumn(name = "carrosserie_id")
    )
    @Builder.Default
    private Set<Carrosserie> carrosseries = new HashSet<>();
}
