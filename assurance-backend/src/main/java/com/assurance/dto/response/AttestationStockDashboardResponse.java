package com.assurance.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class AttestationStockDashboardResponse {
    private Boolean controleStockActif;
    private Summary summary;
    private List<CompanyUsageStock> stocksParCompagnieUsage;
    private List<SeuilStockAttestationResponse> seuils;

    @Data
    @Builder
    public static class Summary {
        private Long total;
        private Long disponible;
        private Long reservee;
        private Long utilisee;
        private Long annulee;
        private Long desactivee;
    }

    @Data
    @Builder
    public static class CompanyUsageStock {
        private Long compagnieAssuranceId;
        private String compagnieAssuranceNom;
        private Long groupeUsageAttestationId;
        private String groupeUsageAttestationCode;
        private String groupeUsageAttestationLibelle;
        private Long total;
        private Long disponible;
        private Long reservee;
        private Long utilisee;
        private Long annulee;
        private Long desactivee;
        private Integer minimumStock;
        private Boolean stockFaible;
    }
}
