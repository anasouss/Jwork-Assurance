package com.assurance.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class DocumentClientPageResponse {
    private Summary summary;
    private PageInfo page;
    private List<DocumentClientResponse> rows;

    @Getter
    @Builder
    public static class Summary {
        private long total;
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
