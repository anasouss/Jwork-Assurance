package com.assurance.entity;

import com.assurance.enums.TypePartieSinistre;
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

@Entity
@Table(name = "sinistre_parties",
        indexes = @Index(name = "idx_sinistre_partie_sinistre", columnList = "sinistre_id"))
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SinistrePartie extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sinistre_id", nullable = false)
    private Sinistre sinistre;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private TypePartieSinistre type;

    @Column(nullable = false, length = 180)
    private String nom;

    @Column(length = 60)
    private String telephone;

    @Column(length = 100)
    private String cin;

    @Column(name = "numero_permis", length = 100)
    private String numeroPermis;

    @Column(length = 100)
    private String immatriculation;

    @Column(name = "compagnie_adverse", length = 180)
    private String compagnieAdverse;

    @Column(name = "numero_police_adverse", length = 100)
    private String numeroPoliceAdverse;

    @Column(length = 1000)
    private String notes;
}
