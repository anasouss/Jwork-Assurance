package com.assurance.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class OperationTresoreriePageResponse {
    private SourceDocumentClientPageResponse.PageInfo page;
    private List<OperationTresorerieResponse> rows;
}
