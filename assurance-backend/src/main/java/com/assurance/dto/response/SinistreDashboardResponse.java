package com.assurance.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
public class SinistreDashboardResponse {
    private long ouverts;
    private long declaresCeMois;
    private long enExpertise;
    private long enAttenteReglement;
    private BigDecimal provisionsOuvertes;
    private BigDecimal reglementsAnnee;
    private BigDecimal recoursAnnee;
    private List<SinistreSummaryResponse> recents;
}
