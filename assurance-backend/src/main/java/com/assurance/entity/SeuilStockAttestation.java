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

import java.time.LocalDateTime;

@Entity
@Table(name = "seuils_stock_attestation",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_seuil_stock_attestation_agence_compagnie_groupe",
                columnNames = {"agence_id", "compagnie_assurance_id", "groupe_usage_attestation_id"}
        ),
        indexes = {
                @Index(name = "idx_seuil_stock_attestation_agence", columnList = "agence_id"),
                @Index(name = "idx_seuil_stock_attestation_compagnie", columnList = "compagnie_assurance_id"),
                @Index(name = "idx_seuil_stock_attestation_groupe", columnList = "groupe_usage_attestation_id")
        })
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SeuilStockAttestation extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agence_id", nullable = false)
    private Agence agence;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "compagnie_assurance_id", nullable = false)
    private CompagnieAssurance compagnieAssurance;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "groupe_usage_attestation_id", nullable = false)
    private GroupeUsageAttestation groupeUsageAttestation;

    @Column(name = "minimum_stock", nullable = false)
    @Builder.Default
    private Integer minimumStock = 0;

    @Column(name = "stock_disponible", nullable = false)
    @Builder.Default
    private Integer stockDisponible = 0;

    @Column(name = "stock_faible", nullable = false)
    @Builder.Default
    private Boolean stockFaible = false;

    @Column(name = "derniere_evaluation")
    private LocalDateTime derniereEvaluation;

    @Builder.Default
    @Column(nullable = false)
    private Boolean actif = true;
}
