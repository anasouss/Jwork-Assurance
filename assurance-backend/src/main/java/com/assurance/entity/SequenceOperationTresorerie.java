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
@Table(
        name = "sequences_operations_tresorerie",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_sequence_operation_tresorerie_agence_annee",
                columnNames = {"agence_id", "annee"}
        ),
        indexes = @Index(name = "idx_sequence_operation_tresorerie_agence", columnList = "agence_id")
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SequenceOperationTresorerie extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agence_id", nullable = false)
    private Agence agence;

    @Column(nullable = false)
    private Integer annee;

    @Column(nullable = false)
    private Long valeur;
}
