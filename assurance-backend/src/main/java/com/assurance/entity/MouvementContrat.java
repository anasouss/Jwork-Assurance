package com.assurance.entity;

import com.assurance.enums.StatutMouvementContrat;
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
@Table(name = "mouvements_contrat", indexes = {
        @Index(name = "idx_mouvement_contrat", columnList = "contrat_id"),
        @Index(name = "idx_mouvement_agence", columnList = "agence_id"),
        @Index(name = "idx_mouvement_type", columnList = "type_mouvement_id"),
        @Index(name = "idx_mouvement_statut", columnList = "statut")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MouvementContrat extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agence_id", nullable = false)
    private Agence agence;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contrat_id", nullable = false)
    private Contrat contrat;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contrat_origine_id")
    private Contrat contratOrigine;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "type_mouvement_id", nullable = false)
    private TypeMouvementContrat typeMouvement;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    @Builder.Default
    private StatutMouvementContrat statut = StatutMouvementContrat.BROUILLON;

    @Column(name = "numero_mouvement", length = 80)
    private String numeroMouvement;

    @Column(name = "date_effet")
    private LocalDate dateEffet;

    @Column(name = "date_echeance")
    private LocalDate dateEcheance;

    @Column(name = "date_validation")
    private LocalDate dateValidation;

    @Column(name = "prime_nette", precision = 14, scale = 2)
    private BigDecimal primeNette;

    @Column(precision = 14, scale = 2)
    private BigDecimal taxe;

    @Column(name = "taxe_parafiscale", precision = 14, scale = 2)
    private BigDecimal taxeParafiscale;

    @Column(precision = 14, scale = 2)
    private BigDecimal accessoire;

    @Column(precision = 14, scale = 2)
    private BigDecimal cnpac;

    @Column(name = "prime_totale", precision = 14, scale = 2)
    private BigDecimal primeTotale;

    @Column(length = 1000)
    private String notes;

    @OneToMany(mappedBy = "mouvementContrat", orphanRemoval = true)
    @Builder.Default
    private List<MouvementVehicule> vehicules = new ArrayList<>();

    @OneToMany(mappedBy = "mouvementContrat", orphanRemoval = true)
    @Builder.Default
    private List<MouvementRemorque> remorques = new ArrayList<>();

    @OneToMany(mappedBy = "mouvementContrat", orphanRemoval = true)
    @Builder.Default
    private List<MouvementGarantie> garanties = new ArrayList<>();
}
