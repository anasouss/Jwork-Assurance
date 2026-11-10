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
@Table(name = "agences_compagnies_assistance",
        uniqueConstraints = @UniqueConstraint(name = "uk_agence_compagnie_assistance",
                columnNames = {"agence_id", "compagnie_assistance_id"}),
        indexes = {
                @Index(name = "idx_agence_assistance_agence", columnList = "agence_id"),
                @Index(name = "idx_agence_assistance_compagnie", columnList = "compagnie_assistance_id")
        })
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AgenceCompagnieAssistance extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "agence_id", nullable = false)
    private Agence agence;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "compagnie_assistance_id", nullable = false)
    private CompagnieAssistance compagnieAssistance;

    @Column(name = "code_intermediaire", length = 80)
    private String codeIntermediaire;
}
