package com.assurance.entity;

import com.assurance.enums.StatutDocumentClient;
import com.assurance.enums.TypeDocumentClient;
import com.assurance.enums.OrigineDelaiPaiement;
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
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "documents_clients",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_document_client_agence_numero",
                columnNames = {"agence_id", "numero"}
        ),
        indexes = {
                @Index(name = "idx_document_client_agence_type", columnList = "agence_id,type_document"),
                @Index(name = "idx_document_client_client", columnList = "client_payeur_id"),
                @Index(name = "idx_document_client_groupe", columnList = "groupe_payeur_id"),
                @Index(name = "idx_document_client_emission", columnList = "date_emission")
        })
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DocumentClient extends AuditedEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agence_id", nullable = false)
    private Agence agence;

    @Enumerated(EnumType.STRING)
    @Column(name = "type_document", nullable = false, length = 20)
    private TypeDocumentClient typeDocument;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private StatutDocumentClient statut = StatutDocumentClient.EMIS;

    @Column(nullable = false, length = 80)
    private String numero;

    @Column(name = "date_emission", nullable = false)
    private LocalDate dateEmission;

    @Column(name = "periode_debut", nullable = false)
    private LocalDate periodeDebut;

    @Column(name = "periode_fin", nullable = false)
    private LocalDate periodeFin;

    @Column(name = "date_echeance")
    private LocalDate dateEcheance;

    @Column(name = "delai_paiement_jours")
    private Integer delaiPaiementJours;

    @Enumerated(EnumType.STRING)
    @Column(name = "origine_delai_paiement", length = 30)
    private OrigineDelaiPaiement origineDelaiPaiement;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "condition_paiement_client_id")
    private ConditionPaiementClient conditionPaiementClient;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "client_payeur_id")
    private Client clientPayeur;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "groupe_payeur_id")
    private GroupeClient groupePayeur;

    @Column(name = "payeur_nom", nullable = false, length = 220)
    private String payeurNom;

    @Column(name = "payeur_identifiant", length = 160)
    private String payeurIdentifiant;

    @Column(name = "payeur_adresse", length = 500)
    private String payeurAdresse;

    @Column(name = "total_debit", nullable = false, precision = 16, scale = 2)
    private BigDecimal totalDebit;

    @Column(name = "total_credit", nullable = false, precision = 16, scale = 2)
    private BigDecimal totalCredit;

    @Column(name = "total_document", nullable = false, precision = 16, scale = 2)
    private BigDecimal totalDocument;

    @Column(length = 1000)
    private String notes;

    @Column(name = "date_annulation")
    private LocalDateTime dateAnnulation;

    @Column(name = "motif_annulation", length = 500)
    private String motifAnnulation;

    @OneToMany(mappedBy = "document", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<LigneDocumentClient> lignes = new ArrayList<>();
}
