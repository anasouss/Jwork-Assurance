package com.assurance.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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

@Entity
@Table(name = "elements_facturables_cibles", indexes = {
        @Index(name = "idx_element_facturable_cible_element", columnList = "element_facturable_id"),
        @Index(name = "idx_element_facturable_cible_contrat", columnList = "contrat_id"),
        @Index(name = "idx_element_facturable_cible_vehicule", columnList = "vehicule_id"),
        @Index(name = "idx_element_facturable_cible_remorque", columnList = "remorque_id"),
        @Index(name = "idx_element_facturable_cible_kind", columnList = "kind")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ElementFacturableCible extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "element_facturable_id", nullable = false)
    private ElementFacturable elementFacturable;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contrat_id", nullable = false)
    private Contrat contrat;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "vehicule_id")
    private Vehicule vehicule;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "remorque_id")
    private Remorque remorque;

    @Column(nullable = false, length = 30)
    private String kind;

    @Column(name = "target_index")
    private Integer targetIndex;

    @Column(name = "prime_nette", precision = 14, scale = 2)
    private BigDecimal primeNette;

    @Column(name = "prime_nette_hors_evcat", precision = 14, scale = 2)
    private BigDecimal primeNetteHorsEvcat;

    @Column(name = "automobile_prime_nette", precision = 14, scale = 2)
    private BigDecimal automobilePrimeNette;

    @Column(name = "corporel_prime_nette", precision = 14, scale = 2)
    private BigDecimal corporelPrimeNette;

    @Column(name = "evcat_prime_nette", precision = 14, scale = 2)
    private BigDecimal evcatPrimeNette;

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

    @Builder.Default
    @Column(nullable = false)
    private Boolean actif = true;
}
