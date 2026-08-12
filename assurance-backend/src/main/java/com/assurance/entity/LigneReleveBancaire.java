package com.assurance.entity;

import com.assurance.enums.StatutLigneReleveBancaire;
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
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(
        name = "lignes_releves_bancaires",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_ligne_releve_import_numero",
                columnNames = {"import_releve_id", "numero_ligne"}
        ),
        indexes = {
                @Index(name = "idx_ligne_releve_import_statut", columnList = "import_releve_id,statut"),
                @Index(name = "idx_ligne_releve_date_montant", columnList = "date_operation,credit,debit")
        }
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LigneReleveBancaire extends AuditedEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "import_releve_id", nullable = false)
    private ImportReleveBancaire importReleve;

    @Column(name = "numero_ligne", nullable = false)
    private Integer numeroLigne;

    @Column(name = "date_operation", nullable = false)
    private LocalDate dateOperation;

    @Column(name = "date_valeur")
    private LocalDate dateValeur;

    @Column(nullable = false, length = 1000)
    private String libelle;

    @Column(name = "reference_bancaire", length = 200)
    private String referenceBancaire;

    @Column(name = "contrepartie", length = 300)
    private String contrepartie;

    @Column(name = "compte_contrepartie", length = 120)
    private String compteContrepartie;

    @Column(nullable = false, precision = 16, scale = 2)
    private BigDecimal debit;

    @Column(nullable = false, precision = 16, scale = 2)
    private BigDecimal credit;

    @Column(precision = 16, scale = 2)
    private BigDecimal solde;

    @Column(name = "donnees_brutes_json", columnDefinition = "text")
    private String donneesBrutesJson;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private StatutLigneReleveBancaire statut;

    @OneToMany(mappedBy = "ligneReleve", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<RapprochementBancaire> rapprochements = new ArrayList<>();
}
