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
@Table(name = "agences_compagnies_assurance",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_agence_compagnie_assurance",
                columnNames = {"agence_id", "compagnie_assurance_id"}
        ),
        indexes = {
                @Index(name = "idx_agence_compagnie_agence", columnList = "agence_id"),
                @Index(name = "idx_agence_compagnie_compagnie", columnList = "compagnie_assurance_id")
        })
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AgenceCompagnieAssurance extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "agence_id", nullable = false)
    private Agence agence;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "compagnie_assurance_id", nullable = false)
    private CompagnieAssurance compagnieAssurance;

    @Column(name = "code_intermediaire", length = 80)
    private String codeIntermediaire;
}
