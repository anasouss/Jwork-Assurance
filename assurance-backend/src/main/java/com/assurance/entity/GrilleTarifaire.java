package com.assurance.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "grilles_tarifaires", indexes = {
        @Index(name = "idx_grille_agence", columnList = "agence_id"),
        @Index(name = "idx_grille_compagnie", columnList = "compagnie_assurance_id")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GrilleTarifaire extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agence_id")
    private Agence agence;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "compagnie_assurance_id", nullable = false)
    private CompagnieAssurance compagnieAssurance;

    @Column(nullable = false, length = 160)
    private String libelle;

    @Column(length = 500)
    private String description;

    @Builder.Default
    @Column(nullable = false)
    private Boolean actif = true;

    @OneToMany(mappedBy = "grilleTarifaire", orphanRemoval = true)
    @Builder.Default
    private List<LigneGrilleTarifaire> lignes = new ArrayList<>();
}
