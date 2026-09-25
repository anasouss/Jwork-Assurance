package com.assurance.entity;

import com.assurance.enums.TypeBordereauRemise;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
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
@Table(name = "sequences_bordereaux_remise", uniqueConstraints = @UniqueConstraint(
        name = "uk_sequence_bordereau_remise",
        columnNames = {"agence_id", "type_bordereau", "annee"}
))
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SequenceBordereauRemise extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agence_id", nullable = false)
    private Agence agence;

    @Enumerated(EnumType.STRING)
    @Column(name = "type_bordereau", nullable = false, length = 30)
    private TypeBordereauRemise type;

    @Column(nullable = false)
    private Integer annee;

    @Column(nullable = false)
    private Long valeur;
}
