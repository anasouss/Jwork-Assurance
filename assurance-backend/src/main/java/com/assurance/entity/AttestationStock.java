package com.assurance.entity;

import com.assurance.enums.StatutAttestationStock;
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

import java.time.LocalDateTime;

@Entity
@Table(name = "attestations_stock",
        uniqueConstraints = @UniqueConstraint(name = "uk_attestation_stock_numero", columnNames = "numero"),
        indexes = {
                @Index(name = "idx_attestation_stock_compagnie", columnList = "compagnie_assurance_id"),
                @Index(name = "idx_attestation_stock_groupe", columnList = "groupe_usage_attestation_id"),
                @Index(name = "idx_attestation_stock_statut", columnList = "statut"),
                @Index(name = "idx_attestation_stock_contrat", columnList = "contrat_id"),
                @Index(name = "idx_attestation_stock_mouvement", columnList = "mouvement_contrat_id")
        })
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AttestationStock extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lot_id", nullable = false)
    private LotAttestation lot;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "compagnie_assurance_id", nullable = false)
    private CompagnieAssurance compagnieAssurance;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "groupe_usage_attestation_id", nullable = false)
    private GroupeUsageAttestation groupeUsageAttestation;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usage_id")
    private Usage usageRepresentatif;

    @Column(nullable = false, length = 100)
    private String numero;

    @Column(length = 60)
    private String serie;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    @Builder.Default
    private StatutAttestationStock statut = StatutAttestationStock.DISPONIBLE;

    @Column(name = "date_utilisation")
    private LocalDateTime dateUtilisation;

    @Column(name = "date_annulation")
    private LocalDateTime dateAnnulation;

    @Column(name = "motif_annulation", length = 1000)
    private String motifAnnulation;

    @Column(name = "numero_dossier", length = 80)
    private String numeroDossier;

    @Column(name = "numero_police", length = 80)
    private String numeroPolice;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contrat_id")
    private Contrat contrat;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "mouvement_contrat_id")
    private MouvementContrat mouvementContrat;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "vehicule_id")
    private Vehicule vehicule;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "remorque_id")
    private Remorque remorque;

    @Builder.Default
    @Column(nullable = false)
    private Boolean actif = true;
}
