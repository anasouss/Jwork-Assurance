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
@Table(name = "assistances_contrat", indexes = {
        @Index(name = "idx_assistance_contrat", columnList = "contrat_id"),
        @Index(name = "idx_assistance_mouvement", columnList = "mouvement_contrat_id"),
        @Index(name = "idx_assistance_vehicule", columnList = "vehicule_id")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AssistanceContrat extends BaseEntity {

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
    private CompagnieAssurance compagnieAssuranceContrat;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "compagnie_assistance_id")
    private CompagnieAssistance compagnieAssistance;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "element_facturable_id")
    private ElementFacturable elementFacturable;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "produit_assistance_id")
    private ProduitAssistance produitAssistance;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tarif_produit_assistance_id")
    private TarifProduitAssistance tarifProduitAssistance;

    @Column(name = "produit", length = 160)
    private String produit;

    @Column(name = "date_souscription")
    private LocalDate dateSouscription;

    @Column(name = "date_effet")
    private LocalDate dateEffet;

    @Column(name = "date_echeance")
    private LocalDate dateEcheance;

    @Column(name = "echeance_code", length = 5)
    private String echeanceCode;

    @Column(name = "duree")
    private Integer duree;

    @Column(name = "unite", length = 40)
    private String unite;

    @Column(name = "numero_dossier", length = 80)
    private String numeroDossier;

    @Column(name = "numero_police_contrat", length = 80)
    private String numeroPoliceContrat;

    @Column(name = "numero_contrat_ou_quittance", length = 120)
    private String numeroContratOuQuittance;

    @Column(name = "type_quittance", length = 40)
    private String typeQuittance;

    @Column(name = "prime_nette", precision = 14, scale = 2)
    private BigDecimal primeNette;

    @Column(name = "prime_totale", precision = 14, scale = 2)
    private BigDecimal primeTotale;

    @Builder.Default
    @Column(nullable = false)
    private Boolean actif = true;
}
