package com.assurance.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
public class BordereauCompagniePageResponse {
    private Resume summary;
    private SourceDocumentClientPageResponse.PageInfo page;
    private List<BordereauCompagnieResponse> rows;

    @Data
    @Builder
    public static class Resume {
        private long total;
        private BigDecimal netCompagnie;
        private BigDecimal montantRegle;
        private BigDecimal soldeRestant;
    }
}
