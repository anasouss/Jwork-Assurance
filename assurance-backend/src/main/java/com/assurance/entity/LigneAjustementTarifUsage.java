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

import java.math.BigDecimal;

@Entity
@Table(name = "lignes_ajustement_tarif_usage", uniqueConstraints = {
        @UniqueConstraint(name = "uk_ligne_ajustement_tarif", columnNames = {"ajustement_id", "tarif_usage_id"})
}, indexes = {
        @Index(name = "idx_ligne_ajustement_tarif", columnList = "tarif_usage_id,ajustement_id")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LigneAjustementTarifUsage extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "ajustement_id", nullable = false)
    private AjustementTarifUsage ajustement;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tarif_usage_id", nullable = false)
    private TarifUsage tarifUsage;

    @Column(name = "prime_nette_initiale", nullable = false, precision = 14, scale = 2)
    private BigDecimal primeNetteInitiale;

    @Column(name = "prime_nette_appliquee", nullable = false, precision = 14, scale = 2)
    private BigDecimal primeNetteAppliquee;

    @Column(name = "usage_code_snapshot", length = 50)
    private String usageCodeSnapshot;

    @Column(name = "description_snapshot", length = 500)
    private String descriptionSnapshot;
}
