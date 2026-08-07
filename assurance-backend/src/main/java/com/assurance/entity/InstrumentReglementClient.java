package com.assurance.entity;

import com.assurance.enums.ModeReglementClient;
import com.assurance.enums.StatutInstrumentReglement;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(
        name = "instruments_reglements_clients",
        indexes = {
                @Index(name = "idx_instrument_reglement_statut", columnList = "agence_id,statut"),
                @Index(name = "idx_instrument_reglement_reference", columnList = "reference_instrument")
        }
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InstrumentReglementClient extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agence_id", nullable = false)
    private Agence agence;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reglement_id", nullable = false)
    private ReglementClient reglement;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private ModeReglementClient mode;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private StatutInstrumentReglement statut;

    @Column(nullable = false, precision = 16, scale = 2)
    private BigDecimal montant;

    @Column(name = "date_instrument")
    private LocalDate dateInstrument;

    @Column(name = "date_echeance")
    private LocalDate dateEcheance;

    @Column(name = "reference_instrument", length = 120)
    private String referenceInstrument;

    @Column(name = "banque_emettrice", length = 160)
    private String banqueEmettrice;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "compte_tresorerie_id")
    private CompteTresorerie compteTresorerie;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "instrument_remplace_id")
    private InstrumentReglementClient instrumentRemplace;

    @Column(name = "date_statut", nullable = false)
    private LocalDate dateStatut;

    @Column(name = "motif_statut", length = 500)
    private String motifStatut;

    @OneToMany(mappedBy = "instrument", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<AffectationReglementClient> affectations = new ArrayList<>();
}
