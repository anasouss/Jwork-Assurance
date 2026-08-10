package com.assurance.entity;

import com.assurance.enums.StatutReglementClient;
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
@Table(
        name = "reglements_clients",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_reglement_client_agence_numero",
                columnNames = {"agence_id", "numero"}
        ),
        indexes = {
                @Index(name = "idx_reglement_client_agence_date", columnList = "agence_id,date_reglement"),
                @Index(name = "idx_reglement_client_client", columnList = "client_payeur_id"),
                @Index(name = "idx_reglement_client_groupe", columnList = "groupe_payeur_id")
        }
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReglementClient extends AuditedEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agence_id", nullable = false)
    private Agence agence;

    @Column(nullable = false, length = 80)
    private String numero;

    @Column(name = "date_reglement", nullable = false)
    private LocalDate dateReglement;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "client_payeur_id")
    private Client clientPayeur;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "groupe_payeur_id")
    private GroupeClient groupePayeur;

    @Column(name = "payeur_nom", nullable = false, length = 220)
    private String payeurNom;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private StatutReglementClient statut = StatutReglementClient.VALIDE;

    @Column(name = "montant_total", nullable = false, precision = 16, scale = 2)
    private BigDecimal montantTotal;

    @Column(name = "montant_non_affecte", nullable = false, precision = 16, scale = 2)
    private BigDecimal montantNonAffecte;

    @Column(length = 1000)
    private String notes;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cree_par_id", nullable = false)
    private Utilisateur creePar;

    @Column(name = "date_annulation")
    private LocalDateTime dateAnnulation;

    @Column(name = "motif_annulation", length = 500)
    private String motifAnnulation;

    @OneToMany(mappedBy = "reglement", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<InstrumentReglementClient> instruments = new ArrayList<>();
}
