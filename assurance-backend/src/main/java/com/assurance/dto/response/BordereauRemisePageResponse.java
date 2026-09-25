package com.assurance.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.List;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BordereauRemisePageResponse {
    private SourceDocumentClientPageResponse.PageInfo page;
    private List<BordereauRemiseResponse> rows;
}
