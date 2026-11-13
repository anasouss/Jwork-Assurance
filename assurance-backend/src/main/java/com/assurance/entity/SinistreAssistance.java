package com.assurance.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;

@Embeddable
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SinistreAssistance {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assistance_contrat_id", nullable = false)
    private AssistanceContrat assistance;

    @Column(name = "reference_snapshot", length = 120)
    private String reference;

    @Column(name = "compagnie_snapshot", length = 180)
    private String compagnie;

    @Column(name = "produit_snapshot", length = 160)
    private String produit;

    @Column(name = "date_effet_snapshot", nullable = false)
    private LocalDate dateEffet;

    @Column(name = "date_echeance_snapshot", nullable = false)
    private LocalDate dateEcheance;
}
