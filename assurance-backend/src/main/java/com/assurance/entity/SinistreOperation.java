package com.assurance.entity;

import com.assurance.enums.ModeReglementSinistre;
import com.assurance.enums.TypeContrepartieSinistre;
import com.assurance.enums.TypeOperationSinistre;
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
@Table(name = "sinistre_operations",
        indexes = @Index(name = "idx_sinistre_operation", columnList = "sinistre_id,date_operation"))
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SinistreOperation extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sinistre_id", nullable = false)
    private Sinistre sinistre;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "saisi_par_id", nullable = false)
    private Utilisateur saisiPar;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "operation_annulee_id")
    private SinistreOperation operationAnnulee;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private TypeOperationSinistre type;

    @Column(name = "date_operation", nullable = false)
    private LocalDate dateOperation;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal montant;

    @Column(length = 120)
    private String reference;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "compagnie_assurance_id", nullable = false)
    private CompagnieAssurance compagnieAssurance;

    @Enumerated(EnumType.STRING)
    @Column(name = "type_contrepartie", nullable = false, length = 30)
    private TypeContrepartieSinistre typeContrepartie;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contrepartie_client_id")
    private Client contrepartieClient;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contrepartie_partie_id")
    private SinistrePartie contrepartiePartie;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contrepartie_expert_id")
    private ExpertSinistre contrepartieExpert;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contrepartie_garage_id")
    private GarageSinistre contrepartieGarage;

    @Column(name = "contrepartie_nom_snapshot", length = 180)
    private String contrepartieNomSnapshot;

    @Column(name = "contrepartie_nom_libre", length = 180)
    private String contrepartieNomLibre;

    @Column(name = "justification_contrepartie_libre", length = 500)
    private String justificationContrepartieLibre;

    @Enumerated(EnumType.STRING)
    @Column(name = "mode_reglement", nullable = false, length = 80)
    private ModeReglementSinistre modeReglement;

    @Column(length = 500)
    private String notes;
}
