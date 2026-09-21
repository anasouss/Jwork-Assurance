package com.assurance.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.util.List;

@Getter
@Builder
public class SourceDocumentClientPageResponse {
    private Summary summary;
    private PageInfo page;
    private List<SourceDocumentClientResponse> rows;

    @Getter
    @Builder
    public static class Summary {
        private long total;
        private BigDecimal soldeImpaye;
        private BigDecimal montantFacture;
        private BigDecimal impayeFacture;
        private BigDecimal impayeNonFacture;
    }

    @Getter
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
