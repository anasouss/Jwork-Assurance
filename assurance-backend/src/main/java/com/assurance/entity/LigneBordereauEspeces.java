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

import java.math.BigDecimal;

@Entity
@Table(
        name = "lignes_bordereau_especes",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_ligne_bordereau_especes_mouvement",
                columnNames = "mouvement_tresorerie_id"
        ),
        indexes = {
                @Index(name = "idx_ligne_bordereau_especes_bordereau", columnList = "bordereau_remise_id"),
                @Index(name = "idx_ligne_bordereau_especes_operation", columnList = "operation_tresorerie_id")
        }
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LigneBordereauEspeces extends AuditedEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "bordereau_remise_id", nullable = false)
    private BordereauRemise bordereau;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "mouvement_tresorerie_id", nullable = false)
    private MouvementTresorerie mouvementTresorerie;

    @Column(nullable = false, precision = 16, scale = 2)
    private BigDecimal montant;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "operation_tresorerie_id")
    private OperationTresorerie operationTresorerie;
}
