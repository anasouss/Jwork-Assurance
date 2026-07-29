package com.assurance.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
public class AffectationQuittancePageResponse {
    private Summary summary;
    private PageInfo page;
    private List<AffectationQuittanceResponse> rows;

    @Data
    @Builder
    public static class Summary {
        private long total;
        private long nonAffectees;
        private long partiellementAffectees;
        private long affectees;
        private long avecEcart;
        private BigDecimal montantTtc;
        private BigDecimal montantAffecte;
    }

    @Data
    @Builder
    public static class PageInfo {
        private int number;
        private int size;
        private long totalElements;
        private int totalPages;
        private boolean first;
        private boolean last;
    }
}
