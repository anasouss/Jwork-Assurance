package com.assurance.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@Entity
@Table(name = "accords_prestataires_sinistre", uniqueConstraints = {
        @UniqueConstraint(name = "uk_accord_expert_compagnie", columnNames = {"expert_id", "compagnie_id"}),
        @UniqueConstraint(name = "uk_accord_garage_compagnie", columnNames = {"garage_id", "compagnie_id"})
}, indexes = @Index(name = "idx_accord_prestataire_agence", columnList = "agence_id,compagnie_id,actif"))
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AccordPrestataireSinistre extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agence_id", nullable = false)
    private Agence agence;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "expert_id")
    private ExpertSinistre expert;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "garage_id")
    private GarageSinistre garage;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "compagnie_id", nullable = false)
    private CompagnieAssurance compagnie;

    @Builder.Default
    @Column(nullable = false)
    private boolean actif = true;

    @Column(nullable = false)
    private boolean conventionne;

    @Column(name = "date_debut")
    private LocalDate dateDebut;

    @Column(name = "date_fin")
    private LocalDate dateFin;
}
