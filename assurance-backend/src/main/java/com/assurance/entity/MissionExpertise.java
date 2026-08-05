package com.assurance.entity;

import com.assurance.enums.StatutMissionExpertise;
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
@Table(name = "missions_expertise",
        indexes = @Index(name = "idx_mission_expertise_sinistre", columnList = "sinistre_id,date_mission"))
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MissionExpertise extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sinistre_id", nullable = false)
    private Sinistre sinistre;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "expert_id", nullable = false)
    private ExpertSinistre expert;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "garage_id")
    private GarageSinistre garage;

    @Column(name = "expert_nom_snapshot", nullable = false, length = 180)
    private String expertNomSnapshot;

    @Column(name = "garage_nom_snapshot", length = 180)
    private String garageNomSnapshot;

    @Column(name = "reference_mission", length = 100)
    private String referenceMission;

    @Column(name = "date_mission", nullable = false)
    private LocalDate dateMission;

    @Column(name = "date_rapport")
    private LocalDate dateRapport;

    @Column(name = "montant_estime", precision = 19, scale = 2)
    private BigDecimal montantEstime;

    @Column(name = "montant_accepte", precision = 19, scale = 2)
    private BigDecimal montantAccepte;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(nullable = false, length = 30)
    private StatutMissionExpertise statut = StatutMissionExpertise.A_MANDATER;

    @Column(length = 1000)
    private String notes;
}
