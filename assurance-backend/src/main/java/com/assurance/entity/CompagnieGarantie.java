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
import org.hibernate.annotations.ColumnDefault;

@Entity
@Table(name = "compagnie_garanties",
        uniqueConstraints = @UniqueConstraint(name = "uk_compagnie_garantie", columnNames = {"compagnie_assurance_id", "garantie_id"}),
        indexes = {
                @Index(name = "idx_compagnie_garantie_compagnie", columnList = "compagnie_assurance_id"),
                @Index(name = "idx_compagnie_garantie_garantie", columnList = "garantie_id")
        })
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CompagnieGarantie extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "compagnie_assurance_id", nullable = false)
    private CompagnieAssurance compagnieAssurance;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "garantie_id", nullable = false)
    private Garantie garantie;

    @Column(name = "age_max_vehicule_mois")
    private Integer ageMaxVehiculeMois;

    @Builder.Default
    @Column(name = "taux_zero_autorise", nullable = false)
    private Boolean tauxZeroAutorise = true;

    @Builder.Default
    @Column(name = "mode_variable", nullable = false)
    private Boolean modeVariable = false;

    @Builder.Default
    @ColumnDefault("true")
    @Column(name = "prorata_applicable", nullable = false)
    private Boolean prorataApplicable = true;

    @Builder.Default
    @Column(nullable = false)
    private Boolean actif = true;
}
