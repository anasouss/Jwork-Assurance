package com.assurance.entity;

import com.assurance.enums.StatutRapprochementBancaire;
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
import java.time.LocalDateTime;

@Entity
@Table(
        name = "rapprochements_bancaires",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_rapprochement_ligne_instrument",
                columnNames = {"ligne_releve_id", "instrument_reglement_id"}
        ),
        indexes = @Index(
                name = "idx_rapprochement_instrument_statut",
                columnList = "instrument_reglement_id,statut"
        )
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RapprochementBancaire extends AuditedEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ligne_releve_id", nullable = false)
    private LigneReleveBancaire ligneReleve;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "instrument_reglement_id", nullable = false)
    private InstrumentReglementClient instrumentReglement;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "mouvement_tresorerie_id")
    private MouvementTresorerie mouvementTresorerie;

    @Column(nullable = false, precision = 16, scale = 2)
    private BigDecimal montant;

    @Column(name = "score_correspondance")
    private Integer scoreCorrespondance;

    @Column(name = "motif_correspondance", length = 500)
    private String motifCorrespondance;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private StatutRapprochementBancaire statut;

    @Column(name = "valide_le")
    private LocalDateTime valideLe;

    @Column(name = "valide_par_user_id")
    private Long valideParUserId;
}
