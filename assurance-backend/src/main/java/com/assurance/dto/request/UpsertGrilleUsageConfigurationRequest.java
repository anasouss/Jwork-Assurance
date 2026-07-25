package com.assurance.dto.request;

import jakarta.validation.Valid;
import lombok.Data;

import java.util.List;

@Data
public class UpsertGrilleUsageConfigurationRequest {
    @Valid
    private List<UpsertLigneGrilleTarifaireRequest> lignes;

    @Valid
    private List<UpsertFormuleGarantiePersonneRequest> formulesPersonne;
}
