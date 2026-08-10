package com.assurance.entity;

import com.assurance.enums.NiveauAccesCompteTresorerie;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(
        name = "affectations_comptes_tresorerie",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_affectation_compte_tresorerie_user",
                columnNames = {"compte_tresorerie_id", "utilisateur_id"}
        ),
        indexes = {
                @Index(
                        name = "idx_affectation_tresorerie_agence_user",
                        columnList = "agence_id,utilisateur_id,actif"
                ),
                @Index(
                        name = "idx_affectation_tresorerie_compte",
                        columnList = "compte_tresorerie_id,actif"
                )
        }
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AffectationCompteTresorerie extends AuditedEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agence_id", nullable = false)
    private Agence agence;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "compte_tresorerie_id", nullable = false)
    private CompteTresorerie compteTresorerie;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "utilisateur_id", nullable = false)
    private Utilisateur utilisateur;

    @Enumerated(EnumType.STRING)
    @Column(name = "niveau_acces", nullable = false, length = 20)
    private NiveauAccesCompteTresorerie niveauAcces;

    @Column(nullable = false)
    @Builder.Default
    private Boolean actif = true;
}
