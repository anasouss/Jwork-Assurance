package com.assurance.entity;

import com.assurance.enums.StatutLigneBordereauRemise;
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
        name = "lignes_bordereaux_remise",
        indexes = {
                @Index(name = "idx_ligne_bordereau_remise", columnList = "bordereau_id,statut"),
                @Index(name = "idx_ligne_bordereau_instrument", columnList = "instrument_id,statut")
        }
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LigneBordereauRemise extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "bordereau_id", nullable = false)
    private BordereauRemise bordereau;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "instrument_id", nullable = false)
    private InstrumentReglementClient instrument;

    @Column(nullable = false, precision = 16, scale = 2)
    private BigDecimal montant;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private StatutLigneBordereauRemise statut;

    @Column(name = "date_traitement")
    private LocalDate dateTraitement;

    @Column(name = "motif_rejet", length = 500)
    private String motifRejet;
}
