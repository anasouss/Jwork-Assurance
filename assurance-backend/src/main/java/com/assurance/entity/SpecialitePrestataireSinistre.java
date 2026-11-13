package com.assurance.entity;

import com.assurance.enums.TypePrestataireSinistre;
import jakarta.persistence.*;
import lombok.*;

import java.util.LinkedHashSet;
import java.util.Set;

@Entity
@Table(name = "specialites_prestataires_sinistre", uniqueConstraints = @UniqueConstraint(
        name = "uk_specialite_prestataire_agence_code", columnNames = {"agence_id", "code"}))
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SpecialitePrestataireSinistre extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agence_id", nullable = false)
    private Agence agence;

    @Column(nullable = false, length = 40)
    private String code;

    @Column(nullable = false, length = 180)
    private String libelle;

    @Enumerated(EnumType.STRING)
    @Column(name = "type_prestataire", nullable = false, length = 20)
    private TypePrestataireSinistre typePrestataire;

    @Builder.Default
    @Column(nullable = false)
    private boolean actif = true;

    @Builder.Default
    @ManyToMany
    @JoinTable(name = "specialites_prestataires_garanties",
            joinColumns = @JoinColumn(name = "specialite_id"),
            inverseJoinColumns = @JoinColumn(name = "garantie_id"))
    private Set<Garantie> garanties = new LinkedHashSet<>();
}
