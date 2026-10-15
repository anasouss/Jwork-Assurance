package com.assurance.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
@Builder
public class AssistanceVoyageQuoteResponse {
    private LocalDate dateEcheance;
    private BigDecimal primeNette;
    private BigDecimal primeTotale;
    private BigDecimal montantReduction;
    private List<Ligne> lignes;

    @Data
    @Builder
    public static class Ligne {
        private Integer assureIndex;
        private Integer age;
        private Long tarifId;
        private BigDecimal primeNette;
        private BigDecimal primeTotale;
        private BigDecimal montantReduction;
    }
}
