package com.assurance.entity;

import com.assurance.enums.SensMouvementTresorerie;
import com.assurance.enums.StatutOperationTresorerie;
import com.assurance.enums.TypeOperationTresorerie;
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
import jakarta.persistence.Version;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(
        name = "operations_tresorerie",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_operation_tresorerie_agence_numero",
                columnNames = {"agence_id", "numero"}
        ),
        indexes = {
                @Index(name = "idx_operation_tresorerie_agence_date", columnList = "agence_id,date_operation"),
                @Index(name = "idx_operation_tresorerie_source", columnList = "compte_source_id,date_operation"),
                @Index(name = "idx_operation_tresorerie_destination", columnList = "compte_destination_id,date_operation")
        }
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OperationTresorerie extends AuditedEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agence_id", nullable = false)
    private Agence agence;

    @Column(nullable = false, length = 80)
    private String numero;

    @Enumerated(EnumType.STRING)
    @Column(name = "type_operation", nullable = false, length = 30)
    private TypeOperationTresorerie typeOperation;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private StatutOperationTresorerie statut;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "compte_source_id")
    private CompteTresorerie compteSource;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "compte_destination_id")
    private CompteTresorerie compteDestination;

    @Enumerated(EnumType.STRING)
    @Column(name = "sens_ajustement", length = 10)
    private SensMouvementTresorerie sensAjustement;

    @Column(nullable = false, precision = 16, scale = 2)
    private BigDecimal montant;

    @Column(name = "date_operation", nullable = false)
    private LocalDate dateOperation;

    @Column(name = "date_valeur")
    private LocalDate dateValeur;

    @Column(length = 160)
    private String reference;

    @Column(nullable = false, length = 1000)
    private String motif;

    @Column(name = "confirmee_le", nullable = false)
    private LocalDateTime confirmeeLe;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "confirmee_par_id", nullable = false)
    private Utilisateur confirmeePar;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "operation_extournee_id")
    private OperationTresorerie operationExtournee;

    @Column(name = "annulee_le")
    private LocalDateTime annuleeLe;

    @Column(name = "motif_annulation", length = 1000)
    private String motifAnnulation;

    @Version
    private Long version;
}
