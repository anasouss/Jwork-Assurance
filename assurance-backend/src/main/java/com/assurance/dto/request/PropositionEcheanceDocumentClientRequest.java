package com.assurance.dto.request;

import jakarta.validation.constraints.NotEmpty;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class PropositionEcheanceDocumentClientRequest {

    @NotEmpty
    private List<Long> elementFacturableIds;
}
