package com.assurance.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;

@Entity
@Table(name = "quittances_prime_selections", uniqueConstraints = {
        @UniqueConstraint(name = "uk_qps_payment_scope", columnNames = {"agence_id", "reglement_id", "selection_hash"}),
        @UniqueConstraint(name = "uk_qps_agency_number", columnNames = {"agence_id", "numero"})
})
@Getter
@Setter
@NoArgsConstructor
public class QuittancePrimeSelection extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "agence_id", nullable = false)
    private Agence agence;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "reglement_id", nullable = false)
    private ReglementClient reglement;

    @Column(name = "selection_hash", nullable = false, length = 64)
    private String selectionHash;

    @Column(name = "selection_json", nullable = false, columnDefinition = "TEXT")
    private String selectionJson;

    @Column(length = 120)
    private String numero;

    @Column(name = "date_emission", nullable = false)
    private LocalDate dateEmission;

    @Column(name = "chemin_stockage", length = 500)
    private String cheminStockage;
}
