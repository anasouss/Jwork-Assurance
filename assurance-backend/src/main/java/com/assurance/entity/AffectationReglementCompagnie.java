package com.assurance.entity;

import com.assurance.enums.StatutAffectationReglement;
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

import java.math.BigDecimal;

@Entity
@Table(
        name = "affectations_reglements_compagnies",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_affectation_reglement_compagnie_instrument_bordereau",
                columnNames = {"instrument_id", "bordereau_id"}
        ),
        indexes = @Index(
                name = "idx_affectation_reglement_compagnie_bordereau_statut",
                columnList = "bordereau_id,statut"
        )
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AffectationReglementCompagnie extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "instrument_id", nullable = false)
    private InstrumentReglementCompagnie instrument;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "bordereau_id", nullable = false)
    private BordereauCompagnie bordereau;

    @Column(nullable = false, precision = 16, scale = 2)
    private BigDecimal montant;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private StatutAffectationReglement statut;
}
