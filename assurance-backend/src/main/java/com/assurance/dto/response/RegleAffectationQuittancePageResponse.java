package com.assurance.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class RegleAffectationQuittancePageResponse {
    private List<RegleAffectationQuittanceResponse> rows;
    private PageInfo page;

    @Data
    @Builder
    public static class PageInfo {
        private int number;
        private int size;
        private int totalPages;
        private long totalElements;
        private boolean first;
        private boolean last;
    }
}
