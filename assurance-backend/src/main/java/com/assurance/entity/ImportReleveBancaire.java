package com.assurance.entity;

import com.assurance.enums.FormatReleveBancaire;
import com.assurance.enums.StatutImportReleveBancaire;
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
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(
        name = "imports_releves_bancaires",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_import_releve_compte_hash",
                columnNames = {"compte_tresorerie_id", "sha256"}
        ),
        indexes = @Index(
                name = "idx_import_releve_agence_statut",
                columnList = "agence_id,statut,created_at"
        )
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ImportReleveBancaire extends AuditedEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agence_id", nullable = false)
    private Agence agence;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "compte_tresorerie_id", nullable = false)
    private CompteTresorerie compteTresorerie;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "profil_import_id")
    private ProfilImportReleveBancaire profilImport;

    @Column(name = "nom_fichier", nullable = false, length = 255)
    private String nomFichier;

    @Column(name = "cle_stockage", nullable = false, length = 500)
    private String cleStockage;

    @Column(name = "type_contenu", length = 120)
    private String typeContenu;

    @Column(nullable = false, length = 64)
    private String sha256;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private FormatReleveBancaire format;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private StatutImportReleveBancaire statut;

    @Column(name = "configuration_json", nullable = false, columnDefinition = "text")
    private String configurationJson;

    @Column(name = "entetes_json", columnDefinition = "text")
    private String entetesJson;

    @Column(name = "solde_ouverture", precision = 16, scale = 2)
    private BigDecimal soldeOuverture;

    @Column(name = "solde_cloture", precision = 16, scale = 2)
    private BigDecimal soldeCloture;

    @Column(name = "total_debits", nullable = false, precision = 16, scale = 2)
    private BigDecimal totalDebits;

    @Column(name = "total_credits", nullable = false, precision = 16, scale = 2)
    private BigDecimal totalCredits;

    @Column(name = "nombre_lignes", nullable = false)
    private Integer nombreLignes;

    @Column(name = "valide_le")
    private LocalDateTime valideLe;

    @Column(name = "valide_par_user_id")
    private Long valideParUserId;

    @OneToMany(mappedBy = "importReleve", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<LigneReleveBancaire> lignes = new ArrayList<>();
}
