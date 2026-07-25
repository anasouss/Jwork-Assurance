package com.assurance.entity;

import com.assurance.enums.ModeTarificationGarantie;
import com.assurance.enums.NatureSnapshotMouvement;
import com.assurance.enums.SourceValeurGarantie;
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

import java.math.BigDecimal;

@Entity
@Table(name = "mouvement_garanties", indexes = {
        @Index(name = "idx_mouvement_garantie_mouvement", columnList = "mouvement_contrat_id"),
        @Index(name = "idx_mouvement_garantie_garantie", columnList = "garantie_id"),
        @Index(name = "idx_mouvement_garantie_vehicule", columnList = "vehicule_id"),
        @Index(name = "idx_mouvement_garantie_remorque", columnList = "remorque_id"),
        @Index(name = "idx_mouvement_garantie_client", columnList = "client_id")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MouvementGarantie extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "mouvement_contrat_id", nullable = false)
    private MouvementContrat mouvementContrat;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contrat_garantie_id")
    private ContratGarantie contratGarantie;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "garantie_id", nullable = false)
    private Garantie garantie;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "vehicule_id")
    private Vehicule vehicule;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "remorque_id")
    private Remorque remorque;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "client_id")
    private Client client;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ligne_grille_tarifaire_id")
    private LigneGrilleTarifaire ligneGrilleTarifaire;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private NatureSnapshotMouvement nature;

    @Enumerated(EnumType.STRING)
    @Column(name = "mode_selectionne", length = 40)
    private ModeTarificationGarantie modeSelectionne;

    @Enumerated(EnumType.STRING)
    @Column(name = "source_valeur_selectionnee", length = 40)
    private SourceValeurGarantie sourceValeurSelectionnee;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "formule_garantie_personne_id")
    private FormuleGarantiePersonne formuleGarantiePersonne;

    @Column(name = "valeur_venale", precision = 14, scale = 2)
    private BigDecimal valeurVenale;

    @Column(name = "valeur_neuf", precision = 14, scale = 2)
    private BigDecimal valeurNeuf;

    @Column(name = "valeur_glace", precision = 14, scale = 2)
    private BigDecimal valeurGlace;

    @Column(length = 80)
    private String formule;

    @Column(name = "montant_deces", precision = 14, scale = 2)
    private BigDecimal montantDeces;

    @Column(name = "montant_invalidite", precision = 14, scale = 2)
    private BigDecimal montantInvalidite;

    @Column(name = "montant_frais_medicaux", precision = 14, scale = 2)
    private BigDecimal montantFraisMedicaux;

    @Column(name = "montant_frais_hospitalisation", precision = 14, scale = 2)
    private BigDecimal montantFraisHospitalisation;

    @Column(name = "montant_frais_funeraires", precision = 14, scale = 2)
    private BigDecimal montantFraisFuneraires;

    @Column(name = "montant_frais_chirurgie", precision = 14, scale = 2)
    private BigDecimal montantFraisChirurgie;

    @Column(precision = 14, scale = 2)
    private BigDecimal accessoire;

    @Column(precision = 14, scale = 2)
    private BigDecimal capital;

    @Column(precision = 14, scale = 4)
    private BigDecimal taux;

    @Column(precision = 14, scale = 2)
    private BigDecimal prime;

    @Column(precision = 14, scale = 4)
    private BigDecimal tauxFranchise;

    @Column(precision = 14, scale = 2)
    private BigDecimal franchiseMinimale;
}
