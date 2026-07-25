package com.assurance.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

@Entity
@Table(name = "capitaux_responsabilite_civile", indexes = {
        @Index(name = "idx_capital_rc_usage_code", columnList = "usage_code")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CapitalResponsabiliteCivile extends BaseEntity {

    @Column(name = "usage_code", nullable = false, unique = true, length = 80)
    private String usageCode;

    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal capital;

    @Builder.Default
    @Column(nullable = false)
    private Boolean actif = true;
}
