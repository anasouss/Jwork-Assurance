package com.assurance.entity;

import com.assurance.enums.TypeVehiculeContrat;
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
import java.time.LocalDate;

@Entity
@Table(name = "vehicules", indexes = {
        @Index(name = "idx_vehicule_contrat", columnList = "contrat_id"),
        @Index(name = "idx_vehicule_immatriculation", columnList = "immatriculation"),
        @Index(name = "idx_vehicule_categorie_transport", columnList = "categorie_transport_id")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Vehicule extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contrat_id", nullable = false)
    private Contrat contrat;

    @Enumerated(EnumType.STRING)
    @Column(name = "type_vehicule", nullable = false, length = 30)
    private TypeVehiculeContrat typeVehicule;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usage_id")
    private Usage usage;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "marque_id")
    private Marque marque;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "carrosserie_id")
    private Carrosserie carrosserie;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "categorie_transport_id")
    private CategorieTransport categorieTransport;

    @Column(name = "immatriculation", length = 80)
    private String immatriculation;

    @Column(name = "ww_immatriculation", length = 80)
    private String immatriculationProvisoire;

    @Column(length = 40)
    private String carburant;

    @Column(length = 40)
    private String puissanceFiscale;

    @Column(length = 40)
    private String cylindree;

    @Column(length = 40)
    private String nombrePlaces;

    @Column(name = "sous_classe", length = 80)
    private String sousClasse;

    @Column(length = 40)
    private String ptc;

    private LocalDate datePremiereCirculation;

    private LocalDate dateExpirationCarteGrise;

    private LocalDate dateEffet;

    private LocalDate dateEcheance;

    @Column(length = 40)
    private String crm;

    @Column(name = "numero_attestation", length = 80)
    private String numeroAttestation;

    @Builder.Default
    @Column
    private Boolean actif = true;

    @Builder.Default
    @Column(name = "remorque", nullable = false)
    private Boolean remorque = false;

    @Column(name = "coefficient_prorata", precision = 14, scale = 6)
    private BigDecimal coefficientProrata;

    @Column(name = "valeur_venale", precision = 14, scale = 2)
    private BigDecimal valeurVenale;

    @Column(name = "valeur_neuf", precision = 14, scale = 2)
    private BigDecimal valeurNeuf;

    @Column(name = "valeur_glace", precision = 14, scale = 2)
    private BigDecimal valeurGlace;

    @Builder.Default
    @Column(name = "organisme_credit", nullable = false)
    private Boolean organismeCredit = false;

    @Column(name = "nom_organisme_credit", length = 160)
    private String nomOrganismeCredit;

    @Column(name = "montant_credit", precision = 14, scale = 2)
    private BigDecimal montantCredit;

    @Column(name = "date_fin_credit")
    private LocalDate dateFinCredit;
}
