package com.assurance.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
@Table(name = "remorques", indexes = {
        @Index(name = "idx_remorque_contrat", columnList = "contrat_id"),
        @Index(name = "idx_remorque_immatriculation", columnList = "immatriculation")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Remorque extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contrat_id", nullable = false)
    private Contrat contrat;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usage_id")
    private Usage usage;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "marque_id")
    private Marque marque;

    @Column(name = "immatriculation", length = 80)
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
