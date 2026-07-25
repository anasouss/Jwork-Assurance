package com.assurance.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "cartes_vertes", indexes = {
        @Index(name = "idx_carte_verte_contrat", columnList = "contrat_id"),
        @Index(name = "idx_carte_verte_mouvement", columnList = "mouvement_contrat_id"),
        @Index(name = "idx_carte_verte_vehicule", columnList = "vehicule_id")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CarteVerte extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contrat_id", nullable = false)
    private Contrat contrat;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "mouvement_contrat_id")
    private MouvementContrat mouvementContrat;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "vehicule_id")
    private Vehicule vehicule;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "compagnie_assurance_id")
    private CompagnieAssurance compagnieAssurance;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "element_facturable_id")
    private ElementFacturable elementFacturable;

    @Column(name = "numero", length = 80)
    private String numero;

    @Column(name = "produit", length = 160)
    private String produit;

    @Column(name = "date_effet")
    private LocalDate dateEffet;

    @Column(name = "date_echeance")
    private LocalDate dateEcheance;

    @Column(name = "date_creation")
    private LocalDate dateCreation;

    @Column(length = 80)
    private String immatriculation;

    @Column(length = 120)
    private String marque;

    @Column(name = "numero_dossier", length = 80)
    private String numeroDossier;

    @Column(name = "numero_police_contrat", length = 80)
    private String numeroPoliceContrat;

    @Column(name = "type_quittance", length = 40)
    private String typeQuittance;

    @Column(name = "duree")
    private Integer duree;

    @Column(name = "unite", length = 40)
    private String unite;

    @Column(precision = 14, scale = 2)
    private BigDecimal montant;

    @Builder.Default
    @Column(nullable = false)
    private Boolean actif = true;
}
