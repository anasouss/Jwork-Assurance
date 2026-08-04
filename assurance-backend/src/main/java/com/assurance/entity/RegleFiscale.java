package com.assurance.entity;

import com.assurance.enums.BaseCalculRegleFiscale;
import com.assurance.enums.CategorieQuittance;
import com.assurance.enums.ModeCalculRegleFiscale;
import com.assurance.enums.NatureRegleFiscale;
import com.assurance.enums.TypeContrat;
import com.assurance.enums.TypeGarantie;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "regles_fiscales",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_regle_fiscale_code_date",
                columnNames = {"code", "date_debut"}
        ),
        indexes = {
                @Index(name = "idx_regle_fiscale_validite", columnList = "actif,date_debut,date_fin"),
                @Index(name = "idx_regle_fiscale_nature", columnList = "nature"),
                @Index(name = "idx_regle_fiscale_compagnie", columnList = "compagnie_assurance_id"),
                @Index(name = "idx_regle_fiscale_categorie_client", columnList = "categorie_client_id"),
                @Index(name = "idx_regle_fiscale_garantie", columnList = "garantie_id")
        })
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RegleFiscale extends BaseEntity {

    @Column(nullable = false, length = 100)
    private String code;

    @Column(nullable = false, length = 180)
    private String libelle;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private NatureRegleFiscale nature;

    @Enumerated(EnumType.STRING)
    @Column(name = "mode_calcul", nullable = false, length = 30)
    private ModeCalculRegleFiscale modeCalcul;

    @Column(nullable = false, precision = 19, scale = 8)
    private BigDecimal valeur;

    @Enumerated(EnumType.STRING)
    @Column(name = "base_calcul", nullable = false, length = 40)
    private BaseCalculRegleFiscale baseCalcul;

    @Enumerated(EnumType.STRING)
    @Column(name = "categorie_base", length = 40)
    private CategorieQuittance categorieBase;

    @Enumerated(EnumType.STRING)
    @Column(name = "categorie_resultat", nullable = false, length = 40)
    private CategorieQuittance categorieResultat;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "compagnie_assurance_id")
    private CompagnieAssurance compagnieAssurance;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "categorie_client_id")
    private CategorieClient categorieClient;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "garantie_id")
    private Garantie garantie;

    @Enumerated(EnumType.STRING)
    @Column(name = "type_garantie", length = 30)
    private TypeGarantie typeGarantie;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usage_id")
    private Usage usage;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "groupe_usage_attestation_id")
    private GroupeUsageAttestation groupeUsageAttestation;

    @Enumerated(EnumType.STRING)
    @Column(name = "type_contrat", length = 30)
    private TypeContrat typeContrat;

    @Column(name = "date_debut", nullable = false)
    private LocalDate dateDebut;

    @Column(name = "date_fin")
    private LocalDate dateFin;

    @Builder.Default
    @Column(nullable = false)
    private Boolean applicable = true;

    @Builder.Default
    @Column(nullable = false)
    private Integer priorite = 0;

    @Builder.Default
    @Column(nullable = false)
    private Boolean actif = true;

    @Column(length = 500)
    private String description;

    @Column(name = "reference_reglementaire", length = 250)
    private String referenceReglementaire;
}
