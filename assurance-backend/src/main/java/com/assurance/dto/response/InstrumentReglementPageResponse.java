package com.assurance.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class InstrumentReglementPageResponse {

    private SourceDocumentClientPageResponse.PageInfo page;
    private List<ReglementClientResponse.Instrument> rows;
}
