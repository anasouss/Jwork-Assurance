package com.assurance.entity;

import com.assurance.enums.StatutSuiviRejetBancaire;
import com.assurance.enums.TypeMouvementRejetBancaire;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;

@Entity
@Table(name = "mouvements_rejets_bancaires", indexes = {
        @Index(name = "idx_mrb_agence_instrument", columnList = "agence_id,instrument_id,date_operation,id")
})
@Getter
@Setter
@NoArgsConstructor
public class MouvementRejetBancaire extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "agence_id", nullable = false)
    private Agence agence;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "instrument_id", nullable = false)
    private InstrumentReglementClient instrument;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "instrument_source_id")
    private InstrumentReglementClient instrumentSource;

    @Column(name = "date_operation", nullable = false)
    private LocalDate dateOperation;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private TypeMouvementRejetBancaire type;

    @Enumerated(EnumType.STRING)
    @Column(name = "statut_suivi", nullable = false, length = 30)
    private StatutSuiviRejetBancaire statutSuivi;

    @Column(nullable = false, length = 500)
    private String motif;

    @Column(name = "utilisateur_id")
    private Long utilisateurId;

    @Column(name = "utilisateur_nom", length = 255)
    private String utilisateurNom;
}
