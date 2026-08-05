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
import java.time.LocalDate;

@Entity
@Table(name = "provisions_sinistre",
        indexes = @Index(name = "idx_provision_sinistre", columnList = "sinistre_id,date_provision"))
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProvisionSinistre extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sinistre_id", nullable = false)
    private Sinistre sinistre;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "saisie_par_id", nullable = false)
    private Utilisateur saisiePar;

    @Column(name = "date_provision", nullable = false)
    private LocalDate dateProvision;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal montant;

    @Column(nullable = false, length = 500)
    private String motif;
}
