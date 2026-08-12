package com.assurance.entity;

import com.assurance.enums.FormatReleveBancaire;
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
        name = "profils_import_releves_bancaires",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_profil_releve_agence_compte_nom",
                columnNames = {"agence_id", "compte_tresorerie_id", "nom"}
        ),
        indexes = @Index(
                name = "idx_profil_releve_compte_actif",
                columnList = "agence_id,compte_tresorerie_id,actif"
        )
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProfilImportReleveBancaire extends AuditedEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agence_id", nullable = false)
    private Agence agence;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "compte_tresorerie_id", nullable = false)
    private CompteTresorerie compteTresorerie;

    @Column(nullable = false, length = 120)
    private String nom;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private FormatReleveBancaire format;

    @Column(name = "configuration_json", nullable = false, columnDefinition = "text")
    private String configurationJson;

    @Builder.Default
    @Column(nullable = false)
    private Boolean actif = true;
}
