package com.assurance.entity;

import com.assurance.enums.TypeMouvementStockAttestation;
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

import java.time.LocalDateTime;

@Entity
@Table(name = "mouvements_stock_attestation", indexes = {
        @Index(name = "idx_mouvement_stock_attestation", columnList = "attestation_stock_id"),
        @Index(name = "idx_mouvement_stock_contrat", columnList = "contrat_id"),
        @Index(name = "idx_mouvement_stock_type", columnList = "type_mouvement")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MouvementStockAttestation extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "attestation_stock_id", nullable = false)
    private AttestationStock attestationStock;

    @Enumerated(EnumType.STRING)
    @Column(name = "type_mouvement", nullable = false, length = 40)
    private TypeMouvementStockAttestation typeMouvement;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contrat_id")
    private Contrat contrat;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "mouvement_contrat_id")
    private MouvementContrat mouvementContrat;

    @Column(name = "numero_avant", length = 100)
    private String numeroAvant;

    @Column(name = "numero_apres", length = 100)
    private String numeroApres;

    @Column(name = "date_mouvement", nullable = false)
    private LocalDateTime dateMouvement;

    @Column(length = 1000)
    private String notes;
}
