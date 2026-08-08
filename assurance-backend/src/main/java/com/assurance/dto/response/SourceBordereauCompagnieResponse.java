package com.assurance.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@Builder
public class SourceBordereauCompagnieResponse {
    private Long id;
    private Long compagnieId;
    private String compagnie;
    private Long quittanceId;
    private String numeroQuittanceCompagnie;
    private String numeroPolice;
    private String numeroDossier;
    private String mouvement;
    private LocalDate dateEffet;
    private LocalDate dateEcheance;
    private BigDecimal primeNette;
    private BigDecimal montantTaxes;
    private BigDecimal accessoires;
    private BigDecimal montantTtc;
    private BigDecimal commissionNette;
    private BigDecimal montantRetenue;
    private BigDecimal netCompagnie;
    private Boolean encaissementConfirme;
}
