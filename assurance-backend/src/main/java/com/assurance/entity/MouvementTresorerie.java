package com.assurance.entity;

import com.assurance.enums.NatureMouvementTresorerie;
import com.assurance.enums.SensMouvementTresorerie;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(
        name = "mouvements_tresorerie",
        indexes = {
                @Index(
                        name = "idx_mouvement_tresorerie_compte_date",
                        columnList = "compte_tresorerie_id,date_operation"
                ),
                @Index(name = "idx_mouvement_tresorerie_instrument", columnList = "instrument_reglement_id")
        }
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MouvementTresorerie extends AuditedEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agence_id", nullable = false)
    private Agence agence;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "compte_tresorerie_id", nullable = false)
    private CompteTresorerie compteTresorerie;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "instrument_reglement_id")
    private InstrumentReglementClient instrumentReglement;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "instrument_reglement_compagnie_id")
    private InstrumentReglementCompagnie instrumentReglementCompagnie;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "operation_tresorerie_id")
    private OperationTresorerie operationTresorerie;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_caisse_id")
    private SessionCaisse sessionCaisse;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private NatureMouvementTresorerie nature;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private SensMouvementTresorerie sens;

    @Column(name = "date_operation", nullable = false)
    private LocalDate dateOperation;

    @Column(name = "date_valeur")
    private LocalDate dateValeur;

    @Column(nullable = false, precision = 16, scale = 2)
    private BigDecimal montant;

    @Column(length = 160)
    private String reference;

    @Column(nullable = false, length = 300)
    private String libelle;

    @Column(name = "mouvement_extourne_id")
    private Long mouvementExtourneId;
}
