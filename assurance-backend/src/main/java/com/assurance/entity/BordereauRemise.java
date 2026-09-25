package com.assurance.entity;

import com.assurance.enums.StatutBordereauRemise;
import com.assurance.enums.TypeBordereauRemise;
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
        name = "bordereaux_remise",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_bordereau_remise_agence_numero",
                columnNames = {"agence_id", "numero"}
        ),
        indexes = {
                @Index(name = "idx_bordereau_remise_agence_statut", columnList = "agence_id,statut"),
                @Index(name = "idx_bordereau_remise_compte", columnList = "compte_destination_id,date_bordereau")
        }
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BordereauRemise extends AuditedEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agence_id", nullable = false)
    private Agence agence;

    @Column(nullable = false, length = 40)
    private String numero;

    @Enumerated(EnumType.STRING)
    @Column(name = "type_bordereau", nullable = false, length = 30)
    private TypeBordereauRemise type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private StatutBordereauRemise statut;

    @Column(name = "date_bordereau", nullable = false)
    private LocalDate dateBordereau;

    @Column(name = "date_depot")
    private LocalDate dateDepot;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "compte_destination_id", nullable = false)
    private CompteTresorerie compteDestination;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "compte_source_id")
    private CompteTresorerie compteSource;

    @Column(name = "montant_total", nullable = false, precision = 16, scale = 2)
    private BigDecimal montantTotal;

    @Column(name = "reference_bancaire", length = 120)
    private String referenceBancaire;

    @Column(length = 1000)
    private String notes;

    @Column(name = "operation_tresorerie_id")
    private Long operationTresorerieId;

    @OneToMany(mappedBy = "bordereau", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<LigneBordereauRemise> lignes = new ArrayList<>();
}
