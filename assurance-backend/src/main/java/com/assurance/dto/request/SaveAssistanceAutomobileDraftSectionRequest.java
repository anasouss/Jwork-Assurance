package com.assurance.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class SaveAssistanceAutomobileDraftSectionRequest {

    @NotNull
    private Long compagnieAssistanceId;

    @Valid
    private CreateAssistanceAutomobileRequest.Personne personne;

    private Long categorieClientId;

    @Valid
    private CreateAssistanceAutomobileRequest.Vehicule vehicule;
}
