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

@Entity
@Table(name = "lignes_livraison_attestation",
        uniqueConstraints = @UniqueConstraint(name = "uk_ligne_livraison_attestation_groupe", columnNames = {"livraison_id", "groupe_usage_attestation_id"}),
        indexes = {
                @Index(name = "idx_ligne_livraison_attestation", columnList = "livraison_id"),
                @Index(name = "idx_ligne_livraison_attestation_groupe", columnList = "groupe_usage_attestation_id")
        })
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LigneLivraisonAttestation extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "livraison_id", nullable = false)
    private LivraisonAttestation livraison;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usage_id")
    private Usage usageRepresentatif;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "groupe_usage_attestation_id", nullable = false)
    private GroupeUsageAttestation groupeUsageAttestation;

    @Column(name = "quantite_demandee", nullable = false)
    @Builder.Default
    private Integer quantiteDemandee = 0;

    @Column(name = "quantite_recue", nullable = false)
    @Builder.Default
    private Integer quantiteRecue = 0;

    @Builder.Default
    @Column(nullable = false)
    private Boolean actif = true;
}
