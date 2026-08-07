package com.assurance.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class ReglementClientPageResponse {
    private SourceDocumentClientPageResponse.PageInfo page;
    private List<ReglementClientResponse> rows;
}
