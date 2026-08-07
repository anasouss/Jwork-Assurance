package com.assurance.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class MouvementTresoreriePageResponse {
    private SourceDocumentClientPageResponse.PageInfo page;
    private List<MouvementTresorerieResponse> rows;
}
