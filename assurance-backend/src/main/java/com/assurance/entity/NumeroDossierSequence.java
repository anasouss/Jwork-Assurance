package com.assurance.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
@Table(name = "numero_dossier_sequences",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_numero_dossier_sequence",
                columnNames = {"agence_id", "compagnie_assurance_id", "annee"}
        ),
        indexes = @Index(
                name = "idx_numero_dossier_sequence_lookup",
                columnList = "agence_id,compagnie_assurance_id,annee"
        ))
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NumeroDossierSequence extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agence_id", nullable = false)
    private Agence agence;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "compagnie_assurance_id", nullable = false)
    private CompagnieAssurance compagnieAssurance;

    @Column(nullable = false)
    private Integer annee;

    @Builder.Default
    @Column(name = "prochain_numero", nullable = false)
    private Integer prochainNumero = 1;
}
