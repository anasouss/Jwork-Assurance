package com.assurance.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
@Table(name = "lignes_documents_clients",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_ligne_document_client_source",
                columnNames = {"document_id", "quittance_id"}
        ),
        indexes = {
        @Index(name = "idx_ligne_document_client_document", columnList = "document_id"),
        @Index(name = "idx_ligne_document_client_quittance", columnList = "quittance_id")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LigneDocumentClient extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "document_id", nullable = false)
    private DocumentClient document;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "quittance_id", nullable = false)
    private Quittance quittance;

    @Column(nullable = false)
    private Integer ordre;

    @Column(name = "date_operation", nullable = false)
    private LocalDate dateOperation;

    @Column(name = "date_echeance")
    private LocalDate dateEcheance;

    @Column(name = "numero_dossier", length = 100)
    private String numeroDossier;

    @Column(name = "numero_police", length = 100)
    private String numeroPolice;

    @Column(name = "numero_quittance", length = 100)
    private String numeroQuittance;

    @Column(name = "mouvement", length = 180)
    private String mouvement;

    @Column(name = "compagnie", length = 180)
    private String compagnie;

    @Column(nullable = false, precision = 16, scale = 2)
    private BigDecimal debit;

    @Column(nullable = false, precision = 16, scale = 2)
    private BigDecimal credit;

    @Column(name = "prime_nette", nullable = false, precision = 16, scale = 2)
    private BigDecimal primeNette;

    @Column(nullable = false, precision = 16, scale = 2)
    private BigDecimal taxes;

    @Column(nullable = false, precision = 16, scale = 2)
    private BigDecimal accessoires;

    @Column(name = "montant_ttc", nullable = false, precision = 16, scale = 2)
    private BigDecimal montantTtc;
}
