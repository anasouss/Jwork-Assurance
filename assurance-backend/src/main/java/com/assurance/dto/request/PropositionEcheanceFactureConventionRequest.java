package com.assurance.dto.request;

import jakarta.validation.constraints.NotEmpty;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class PropositionEcheanceFactureConventionRequest {

    @NotEmpty
    private List<Long> echeanceIds;
}
