package com.assurance.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@Builder
public class AssistanceAutomobileQuoteResponse {
    private Long tarifId;
    private LocalDate dateEcheance;
    private BigDecimal primeNette;
    private BigDecimal primeTotale;
    private BigDecimal montantReduction;
}
