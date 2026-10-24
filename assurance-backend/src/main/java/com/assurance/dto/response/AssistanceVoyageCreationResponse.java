package com.assurance.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@Builder
public class AssistanceVoyageCreationResponse {
    private Long contratId;
    private Long assistanceId;
    private String codeClient;
    private String numeroDossier;
    private String numeroContrat;
    private LocalDate dateEffet;
    private LocalDate dateEcheance;
    private BigDecimal primeNette;
    private BigDecimal primeTotale;
    private BigDecimal montantReduction;
}
