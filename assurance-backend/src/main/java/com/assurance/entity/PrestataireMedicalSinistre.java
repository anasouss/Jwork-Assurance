package com.assurance.entity;

import com.assurance.enums.TypePrestataireSinistre;
import jakarta.persistence.*;
import lombok.*;
import java.util.LinkedHashSet;
import java.util.Set;

@Entity
@Table(name = "prestataires_medicaux_sinistre", uniqueConstraints = @UniqueConstraint(
        name = "uk_prestataire_medical_agence_code", columnNames = {"agence_id", "code"}),
        indexes = @Index(name = "idx_medical_directory", columnList = "agence_id,type_prestataire,actif,nom"))
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PrestataireMedicalSinistre extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agence_id", nullable = false)
    private Agence agence;

    @Enumerated(EnumType.STRING)
    @Column(name = "type_prestataire", nullable = false, length = 30)
    private TypePrestataireSinistre typePrestataire;

    @Column(nullable = false, length = 40)
    private String code;

    @Column(nullable = false, length = 180)
    private String nom;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ville_id")
    private Ville ville;

    @Column(length = 60)
    private String telephone;

    @Column(length = 180)
    private String email;

    @Column(length = 500)
    private String adresse;

    @Builder.Default
    @Column(nullable = false)
    private boolean actif = true;

    @Builder.Default
    @Column(name = "toutes_compagnies", nullable = false)
    private boolean toutesCompagnies = true;

    @Builder.Default
    @ManyToMany
    @JoinTable(name = "prestataires_medicaux_domaines", joinColumns = @JoinColumn(name = "prestataire_id"), inverseJoinColumns = @JoinColumn(name = "domaine_id"))
    private Set<DomaineInterventionSinistre> domaines = new LinkedHashSet<>();

    @Builder.Default
    @ManyToMany
    @JoinTable(name = "prestataires_medicaux_specialites", joinColumns = @JoinColumn(name = "prestataire_id"), inverseJoinColumns = @JoinColumn(name = "specialite_id"))
    private Set<SpecialitePrestataireSinistre> specialites = new LinkedHashSet<>();

    @Builder.Default
    @OneToMany(mappedBy = "prestataireMedical", cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<AccordPrestataireSinistre> accords = new LinkedHashSet<>();
}
