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

@Entity
@Table(name = "experts_sinistre",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_expert_sinistre_agence_code",
                columnNames = {"agence_id", "code"}
        ),
        indexes = @Index(name = "idx_expert_sinistre_agence", columnList = "agence_id,actif"))
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExpertSinistre extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agence_id", nullable = false)
    private Agence agence;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ville_id")
    private Ville ville;

    @Column(nullable = false, length = 40)
    private String code;

    @Column(nullable = false, length = 180)
    private String nom;

    @Column(length = 60)
    private String telephone;

    @Column(length = 180)
    private String email;

    @Column(length = 500)
    private String adresse;

    @Builder.Default
    @Column(nullable = false)
    private boolean actif = true;
}
