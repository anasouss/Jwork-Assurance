package com.assurance.entity;

import com.assurance.enums.NatureSinistre;
import com.assurance.enums.StatutSinistre;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;

@Entity
@Table(name = "sinistres",
        uniqueConstraints = @UniqueConstraint(name = "uk_sinistre_agence_numero", columnNames = {"agence_id", "numero_sinistre"}),
        indexes = {
                @Index(name = "idx_sinistre_agence_statut", columnList = "agence_id,statut"),
                @Index(name = "idx_sinistre_contrat", columnList = "contrat_id"),
                @Index(name = "idx_sinistre_client", columnList = "client_id"),
                @Index(name = "idx_sinistre_date", columnList = "date_sinistre")
        })
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Sinistre extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agence_id", nullable = false)
    private Agence agence;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contrat_id", nullable = false)
    private Contrat contrat;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "mouvement_couverture_id", nullable = false)
    private MouvementContrat mouvementCouverture;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "client_id", nullable = false)
    private Client client;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "vehicule_id")
    private Vehicule vehicule;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "compagnie_assurance_id", nullable = false)
    private CompagnieAssurance compagnieAssurance;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "gestionnaire_id")
    private Utilisateur gestionnaire;

    @Version
    private long version;

    @Column(name = "numero_sinistre", nullable = false, length = 60)
    private String numeroSinistre;

    @Column(name = "reference_compagnie", length = 100)
    private String referenceCompagnie;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private StatutSinistre statut;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private NatureSinistre nature;

    @Column(name = "date_sinistre", nullable = false)
    private LocalDate dateSinistre;

    @Column(name = "heure_sinistre")
    private LocalTime heureSinistre;

    @Column(name = "date_declaration", nullable = false)
    private LocalDate dateDeclaration;

    @Column(name = "date_transmission")
    private LocalDate dateTransmission;

    @Column(name = "date_cloture")
    private LocalDate dateCloture;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ville_id")
    private Ville ville;

    @Column(length = 500)
    private String lieu;

    @Column(length = 4000)
    private String circonstances;

    @Column(name = "numero_pv", length = 120)
    private String numeroPv;

    @Column(name = "taux_responsabilite", precision = 7, scale = 4)
    private BigDecimal tauxResponsabilite;

    @Column(length = 4000)
    private String notes;

    @OneToOne(mappedBy = "sinistre", fetch = FetchType.LAZY)
    private SinistreCouverture couverture;
}
