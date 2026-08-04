package com.assurance.entity;

import com.assurance.enums.BaseCalculRegleFiscale;
import com.assurance.enums.CategorieQuittance;
import com.assurance.enums.ModeCalculRegleFiscale;
import com.assurance.enums.NatureRegleFiscale;
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
@Table(name = "applications_regles_fiscales_quittance", indexes = {
        @Index(name = "idx_application_regle_quittance", columnList = "quittance_id"),
        @Index(name = "idx_application_regle_source", columnList = "regle_fiscale_id")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ApplicationRegleFiscaleQuittance extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "quittance_id", nullable = false)
    private Quittance quittance;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "regle_fiscale_id")
    private RegleFiscale regleFiscale;

    @Column(name = "code_regle", nullable = false, length = 100)
    private String codeRegle;

    @Column(name = "libelle_regle", nullable = false, length = 180)
    private String libelleRegle;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private NatureRegleFiscale nature;

    @Enumerated(EnumType.STRING)
    @Column(name = "mode_calcul", nullable = false, length = 30)
    private ModeCalculRegleFiscale modeCalcul;

    @Enumerated(EnumType.STRING)
    @Column(name = "base_calcul", nullable = false, length = 40)
    private BaseCalculRegleFiscale baseCalcul;

    @Enumerated(EnumType.STRING)
    @Column(name = "categorie_resultat", nullable = false, length = 40)
    private CategorieQuittance categorieResultat;

    @Column(name = "garantie_id")
    private Long garantieId;

    @Column(name = "vehicule_id")
    private Long vehiculeId;

    @Column(name = "remorque_id")
    private Long remorqueId;

    @Column(name = "date_effet", nullable = false)
    private LocalDate dateEffet;

    @Column(name = "valeur_regle", nullable = false, precision = 19, scale = 8)
    private BigDecimal valeurRegle;

    @Column(name = "base_montant", nullable = false, precision = 19, scale = 8)
    private BigDecimal baseMontant;

    @Column(name = "montant_calcule", nullable = false, precision = 19, scale = 8)
    private BigDecimal montantCalcule;
}
