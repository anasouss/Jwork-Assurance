package com.assurance.entity;

import com.assurance.enums.ModeSaisieGarantieContrat;
import com.assurance.enums.Fractionnement;
import com.assurance.enums.StatutContrat;
import com.assurance.enums.TypeContrat;
import com.assurance.enums.ModeFacturationContrat;
import com.assurance.enums.ModeTermeRenouvellement;
import com.assurance.enums.TypePayeurPrime;
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
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.BatchSize;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "contrats",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_contrat_agence_numero", columnNames = {"agence_id", "numero_contrat"}),
                @UniqueConstraint(name = "uk_contrat_agence_numero_dossier", columnNames = {"agence_id", "numero_dossier"}),
                @UniqueConstraint(name = "uk_contrat_origine", columnNames = {"contrat_origine_id"})
        },
        indexes = {
                @Index(name = "idx_contrat_agence", columnList = "agence_id"),
                @Index(name = "idx_contrat_compagnie", columnList = "compagnie_assurance_id"),
                @Index(name = "idx_contrat_type", columnList = "contrat_type"),
                @Index(name = "idx_contrat_statut", columnList = "statut")
        })
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Contrat extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agence_id", nullable = false)
    private Agence agence;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "compagnie_assurance_id")
    private CompagnieAssurance compagnieAssurance;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "convention_id")
    private Convention convention;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usage_id")
    private Usage usage;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "grille_tarifaire_id")
    private GrilleTarifaire grilleTarifaire;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contrat_origine_id")
    private Contrat contratOrigine;

    @Enumerated(EnumType.STRING)
    @Column(name = "mode_terme_renouvellement", length = 30)
    private ModeTermeRenouvellement modeTermeRenouvellement;

    @Enumerated(EnumType.STRING)
    @Column(name = "contrat_type", nullable = false, length = 30)
    private TypeContrat typeContrat;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    @Builder.Default
    private StatutContrat statut = StatutContrat.DRAFT;

    @Column(name = "numero_contrat", length = 80)
    private String numeroContrat;

    @Column(name = "numero_devis", length = 80)
    private String numeroDevis;

    @Column(name = "numero_dossier", length = 80)
    private String numeroDossier;

    @Column(name = "numero_police", length = 80)
    private String numeroPolice;

    @Column(name = "numero_attestation", length = 80)
    private String numeroAttestation;

    @Column(name = "date_effet")
    private LocalDate dateEffet;

    @Column(name = "date_echeance")
    private LocalDate dateEcheance;

    @Column(name = "type_renouvellement", length = 40)
    private String typeRenouvellement;

    @Column(length = 40)
    private String periodicite;

    @Enumerated(EnumType.STRING)
    @Column(length = 30)
    private Fractionnement fractionnement;

    @Column(name = "mode_paiement", length = 60)
    private String modePaiement;

    @Column(name = "mode_reglement", length = 60)
    private String modeReglement;

    @Column(name = "numero_bon_commande", length = 120)
    private String numeroBonCommande;

    @Column(name = "montant_bulletin", precision = 19, scale = 2)
    private BigDecimal montantBulletin;

    @Enumerated(EnumType.STRING)
    @Column(name = "type_payeur_prime", length = 30)
    @Builder.Default
    private TypePayeurPrime typePayeurPrime = TypePayeurPrime.SOUSCRIPTEUR;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "payeur_prime_client_id")
    private Client payeurPrime;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "groupe_facturation_id")
    private GroupeClient groupeFacturation;

    @Enumerated(EnumType.STRING)
    @Column(name = "mode_facturation", length = 30)
    @Builder.Default
    private ModeFacturationContrat modeFacturation = ModeFacturationContrat.DIRECTE;

    @Column(name = "reference_mandat_payeur", length = 160)
    private String referenceMandatPayeur;

    @Column(length = 80)
    private String echeance;

    @Column(name = "etat_paiement", length = 60)
    private String etatPaiement;

    @Column(name = "taux_rc", precision = 14, scale = 4)
    private java.math.BigDecimal tauxRc;

    @Enumerated(EnumType.STRING)
    @Column(name = "mode_saisie_garanties", nullable = false, length = 40)
    @Builder.Default
    private ModeSaisieGarantieContrat modeSaisieGaranties = ModeSaisieGarantieContrat.MANUELLE;

    @Builder.Default
    @Column(name = "saisie_prime_nette", nullable = false)
    private Boolean saisiePrimeNette = false;

    @Column(name = "nombre_vehicules")
    private Integer nombreVehicules;

    @Column(name = "nombre_remorques")
    private Integer nombreRemorques;

    @Builder.Default
    @Column(name = "prospection", nullable = false)
    private Boolean prospection = false;

    @Builder.Default
    @Column(name = "brouillon", nullable = false)
    private Boolean brouillon = true;

    @Builder.Default
    @Column(name = "renouvele", nullable = false)
    private Boolean renouvele = false;

    @Builder.Default
    @Column(name = "assistance", nullable = false)
    private Boolean assistance = false;

    @Builder.Default
    @Column(name = "crm_partage", nullable = false)
    private Boolean crmPartage = false;

    @Column(name = "crm_partage_valeur", length = 40)
    private String crmPartageValeur;

    @Column(length = 1000)
    private String notes;

    @OneToMany(mappedBy = "contrat", orphanRemoval = true)
    @Builder.Default
    @BatchSize(size = 100)
    private List<ContratClient> clients = new ArrayList<>();

    @OneToMany(mappedBy = "contrat", orphanRemoval = true)
    @Builder.Default
    @BatchSize(size = 100)
    private List<Vehicule> vehicules = new ArrayList<>();

    @OneToMany(mappedBy = "contrat", orphanRemoval = true)
    @Builder.Default
    private List<Remorque> remorques = new ArrayList<>();

    @OneToMany(mappedBy = "contrat", orphanRemoval = true)
    @Builder.Default
    private List<ContratGarantie> garanties = new ArrayList<>();

    @OneToMany(mappedBy = "contrat", orphanRemoval = true)
    @Builder.Default
    private List<Quittance> quittances = new ArrayList<>();

    @OneToMany(mappedBy = "contratOrigine")
    @Builder.Default
    private List<Contrat> renouvellements = new ArrayList<>();

    @OneToMany(mappedBy = "contrat", orphanRemoval = true)
    @Builder.Default
    private List<MouvementContrat> mouvements = new ArrayList<>();

    @OneToMany(mappedBy = "contrat", orphanRemoval = true)
    @Builder.Default
    private List<ElementFacturable> elementsFacturables = new ArrayList<>();

    @OneToMany(mappedBy = "contrat", orphanRemoval = true)
    @Builder.Default
    private List<PieceJointe> piecesJointes = new ArrayList<>();

    @OneToMany(mappedBy = "contrat", orphanRemoval = true)
    @Builder.Default
    private List<CarteVerte> cartesVertes = new ArrayList<>();

    @OneToMany(mappedBy = "contrat", orphanRemoval = true)
    @Builder.Default
    private List<AssistanceContrat> assistances = new ArrayList<>();
}
