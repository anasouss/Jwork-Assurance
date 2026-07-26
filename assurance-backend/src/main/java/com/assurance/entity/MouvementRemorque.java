package com.assurance.entity;

import com.assurance.enums.NatureSnapshotMouvement;
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
@Table(name = "mouvement_remorques", indexes = {
        @Index(name = "idx_mouvement_remorque_mouvement", columnList = "mouvement_contrat_id"),
        @Index(name = "idx_mouvement_remorque_remorque", columnList = "remorque_id")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MouvementRemorque extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "mouvement_contrat_id", nullable = false)
    private MouvementContrat mouvementContrat;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "remorque_id")
    private Remorque remorque;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private NatureSnapshotMouvement nature;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usage_id")
    private Usage usage;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "marque_id")
    private Marque marque;

    @Column(length = 80)
    private String immatriculation;

    @Column(length = 40)
    private String ptc;

    private LocalDate dateMiseEnCirculation;

    private LocalDate dateEffet;

    private LocalDate dateEcheance;

    @Column(length = 40)
    private String crm;

    @Column(name = "numero_attestation", length = 80)
    private String numeroAttestation;

    @Column(name = "coefficient_prorata", precision = 14, scale = 6)
    private BigDecimal coefficientProrata;

    @Column(name = "valeur_assuree", precision = 14, scale = 2)
    private BigDecimal valeurAssuree;
}
