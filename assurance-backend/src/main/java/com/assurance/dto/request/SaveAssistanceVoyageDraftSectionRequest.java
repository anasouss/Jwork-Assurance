package com.assurance.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class SaveAssistanceVoyageDraftSectionRequest {

    @NotNull
    private Long compagnieAssistanceId;

    @NotNull
    private Long produitAssistanceId;

    @Valid
    private CreateAssistanceVoyageRequest.Personne souscripteur;

    @Valid
    private List<CreateAssistanceVoyageRequest.Personne> assures = new ArrayList<>();

    private Boolean assureIdentiqueSouscripteur;
}
