package com.assurance.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "rejets_bancaires", uniqueConstraints = {
        @UniqueConstraint(name = "uk_rejet_agence_numero", columnNames = {"agence_id", "numero"}),
        @UniqueConstraint(name = "uk_rejet_agence_sequence", columnNames = {"agence_id", "annee", "sequence_numero"}),
        @UniqueConstraint(name = "uk_rejet_ligne_remise", columnNames = "ligne_remise_id")
}, indexes = @Index(name = "idx_rejet_agence_instrument", columnList = "agence_id,instrument_id,id"))
@Getter
@Setter
@NoArgsConstructor
public class RejetBancaire extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "agence_id", nullable = false)
    private Agence agence;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "instrument_id", nullable = false)
    private InstrumentReglementClient instrument;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ligne_remise_id")
    private LigneBordereauRemise ligneRemise;

    @Column(nullable = false, length = 40)
    private String numero;

    @Column(nullable = false)
    private Integer annee;

    @Column(name = "sequence_numero", nullable = false)
    private Long sequenceNumero;

    @Column(name = "date_rejet", nullable = false)
    private LocalDate dateRejet;

    @Column(nullable = false, length = 500)
    private String motif;

    @Column(nullable = false, precision = 16, scale = 2)
    private BigDecimal montant;

    @Column(name = "utilisateur_id")
    private Long utilisateurId;

    @Column(name = "utilisateur_nom", length = 255)
    private String utilisateurNom;
}
