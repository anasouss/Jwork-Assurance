package com.assurance.entity;

import com.assurance.enums.Fractionnement;
import com.assurance.enums.StatutEcheanceFacturationConvention;
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

import java.time.LocalDate;

@Entity
@Table(name = "echeances_facturation_convention",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_echeance_facturation_convention_periode",
                columnNames = {"contrat_id", "periode_debut", "periode_fin"}
        ),
        indexes = {
                @Index(name = "idx_echeance_facturation_convention_agence", columnList = "agence_id"),
                @Index(name = "idx_echeance_facturation_convention_contrat", columnList = "contrat_id"),
                @Index(name = "idx_echeance_facturation_convention_statut", columnList = "statut,date_echeance")
        })
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EcheanceFacturationConvention extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agence_id", nullable = false)
    private Agence agence;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contrat_id", nullable = false)
    private Contrat contrat;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "document_client_id")
    private DocumentClient documentClient;

    @Column(name = "numero_periode", nullable = false)
    private Integer numeroPeriode;

    @Column(name = "nombre_periodes", nullable = false)
    private Integer nombrePeriodes;

    @Column(name = "periode_debut", nullable = false)
    private LocalDate periodeDebut;

    @Column(name = "periode_fin", nullable = false)
    private LocalDate periodeFin;

    @Column(name = "date_echeance", nullable = false)
    private LocalDate dateEcheance;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private Fractionnement fractionnement;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    @Builder.Default
    private StatutEcheanceFacturationConvention statut = StatutEcheanceFacturationConvention.A_FACTURER;

    @Column(nullable = false)
    @Builder.Default
    private Boolean actif = true;
}
