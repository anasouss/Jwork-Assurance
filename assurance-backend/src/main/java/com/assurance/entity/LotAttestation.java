package com.assurance.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "lots_attestation", indexes = {
        @Index(name = "idx_lot_attestation_livraison", columnList = "livraison_id"),
        @Index(name = "idx_lot_attestation_groupe", columnList = "groupe_usage_attestation_id")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LotAttestation extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "livraison_id", nullable = false)
    private LivraisonAttestation livraison;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usage_id")
    private Usage usageRepresentatif;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "groupe_usage_attestation_id", nullable = false)
    private GroupeUsageAttestation groupeUsageAttestation;

    @Column(length = 40)
    private String prefixe;

    @Column(name = "numero_debut", length = 80)
    private String numeroDebut;

    @Column(name = "numero_fin", length = 80)
    private String numeroFin;

    @Column(nullable = false)
    private Integer quantite;

    @Builder.Default
    @Column(nullable = false)
    private Boolean actif = true;

    @OneToMany(mappedBy = "lot", orphanRemoval = true)
    @Builder.Default
    private List<AttestationStock> attestations = new ArrayList<>();
}
