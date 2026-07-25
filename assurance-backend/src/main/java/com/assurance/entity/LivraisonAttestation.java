package com.assurance.entity;

import com.assurance.enums.SourceLivraisonAttestation;
import com.assurance.enums.StatutLivraisonAttestation;
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

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "livraisons_attestation", indexes = {
        @Index(name = "idx_livraison_attestation_agence", columnList = "agence_id"),
        @Index(name = "idx_livraison_attestation_compagnie", columnList = "compagnie_assurance_id"),
        @Index(name = "idx_livraison_attestation_statut", columnList = "statut")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LivraisonAttestation extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agence_id")
    private Agence agence;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "compagnie_assurance_id", nullable = false)
    private CompagnieAssurance compagnieAssurance;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    @Builder.Default
    private StatutLivraisonAttestation statut = StatutLivraisonAttestation.DEMANDEE;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    @Builder.Default
    private SourceLivraisonAttestation source = SourceLivraisonAttestation.COMMANDE;

    @Column(name = "date_demande")
    private LocalDate dateDemande;

    @Column(name = "date_reception")
    private LocalDate dateReception;

    @Column(name = "reference_commande", length = 120)
    private String referenceCommande;

    @Column(name = "reference_bl", length = 120)
    private String referenceBl;

    @Column(name = "quantite_demandee", nullable = false)
    @Builder.Default
    private Integer quantiteDemandee = 0;

    @Column(name = "quantite_recue", nullable = false)
    @Builder.Default
    private Integer quantiteRecue = 0;

    @Column(name = "validee", nullable = false)
    @Builder.Default
    private Boolean validee = false;

    @Column(name = "commentaire_decision", length = 1000)
    private String commentaireDecision;

    @Builder.Default
    @Column(nullable = false)
    private Boolean actif = true;

    @OneToMany(mappedBy = "livraison", orphanRemoval = true)
    @Builder.Default
    private List<LigneLivraisonAttestation> lignes = new ArrayList<>();

    @OneToMany(mappedBy = "livraison", orphanRemoval = true)
    @Builder.Default
    private List<LotAttestation> lots = new ArrayList<>();
}
