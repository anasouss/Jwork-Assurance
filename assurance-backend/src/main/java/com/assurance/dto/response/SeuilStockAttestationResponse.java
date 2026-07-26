package com.assurance.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class SeuilStockAttestationResponse {
    private Long id;
    private Long compagnieAssuranceId;
    private String compagnieAssuranceNom;
    private Long groupeUsageAttestationId;
    private String groupeUsageAttestationCode;
    private String groupeUsageAttestationLibelle;
    private Integer minimumStock;
    private Integer stockDisponible;
    private Boolean stockFaible;
    private LocalDateTime derniereEvaluation;
}
