package com.assurance.entity;

import com.assurance.enums.BaseBordereauCompagnie;
import com.assurance.enums.StatutBordereauCompagnie;
import com.assurance.enums.StatutRapprochementCompagnie;
import jakarta.persistence.CascadeType;
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
import jakarta.persistence.Version;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(
        name = "bordereaux_compagnies",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_bordereau_compagnie_agence_numero",
                columnNames = {"agence_id", "numero"}
        ),
        indexes = {
                @Index(name = "idx_bordereau_compagnie_agence_statut", columnList = "agence_id,statut"),
                @Index(
                        name = "idx_bordereau_compagnie_compagnie_periode",
                        columnList = "compagnie_assurance_id,periode_debut,periode_fin"
                )
        }
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BordereauCompagnie extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agence_id", nullable = false)
    private Agence agence;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "compagnie_assurance_id", nullable = false)
    private CompagnieAssurance compagnieAssurance;

    @Column(nullable = false, length = 80)
    private String numero;

    @Enumerated(EnumType.STRING)
    @Column(name = "base_bordereau", nullable = false, length = 20)
    private BaseBordereauCompagnie baseBordereau;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private StatutBordereauCompagnie statut = StatutBordereauCompagnie.BROUILLON;

    @Enumerated(EnumType.STRING)
    @Column(name = "statut_rapprochement", nullable = false, length = 20)
    @Builder.Default
    private StatutRapprochementCompagnie statutRapprochement =
            StatutRapprochementCompagnie.A_RAPPROCHER;

    @Column(name = "periode_debut", nullable = false)
    private LocalDate periodeDebut;

    @Column(name = "periode_fin", nullable = false)
    private LocalDate periodeFin;

    @Column(name = "date_validation")
    private LocalDateTime dateValidation;

    @Column(name = "date_transmission")
    private LocalDate dateTransmission;

    @Column(name = "canal_transmission", length = 80)
    private String canalTransmission;

    @Column(name = "reference_transmission", length = 160)
    private String referenceTransmission;

    @Column(name = "date_accuse_reception")
    private LocalDate dateAccuseReception;

    @Column(name = "reference_accuse_reception", length = 160)
    private String referenceAccuseReception;

    @Column(name = "prime_nette", nullable = false, precision = 16, scale = 2)
    private BigDecimal primeNette;

    @Column(name = "montant_taxes", nullable = false, precision = 16, scale = 2)
    private BigDecimal montantTaxes;

    @Column(nullable = false, precision = 16, scale = 2)
    private BigDecimal accessoires;

    @Column(name = "montant_ttc", nullable = false, precision = 16, scale = 2)
    private BigDecimal montantTtc;

    @Column(name = "commission_nette", nullable = false, precision = 16, scale = 2)
    private BigDecimal commissionNette;

    @Column(name = "montant_retenue", nullable = false, precision = 16, scale = 2)
    private BigDecimal montantRetenue;

    @Column(name = "net_compagnie", nullable = false, precision = 16, scale = 2)
    private BigDecimal netCompagnie;

    @Column(name = "ecart_rapprochement", nullable = false, precision = 16, scale = 2)
    @Builder.Default
    private BigDecimal ecartRapprochement = BigDecimal.ZERO;

    @Column(name = "note_rapprochement", length = 1000)
    private String noteRapprochement;

    @Column(length = 1000)
    private String notes;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cree_par_id", nullable = false)
    private Utilisateur creePar;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "valide_par_id")
    private Utilisateur validePar;

    @Column(name = "date_annulation")
    private LocalDateTime dateAnnulation;

    @Column(name = "motif_annulation", length = 500)
    private String motifAnnulation;

    @Version
    @Column(nullable = false)
    private Long version;

    @OneToMany(mappedBy = "bordereau", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<LigneBordereauCompagnie> lignes = new ArrayList<>();
}
