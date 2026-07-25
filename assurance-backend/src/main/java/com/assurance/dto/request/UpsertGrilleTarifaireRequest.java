package com.assurance.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class UpsertGrilleTarifaireRequest {
    private String agenceId;

    @NotBlank
    private String compagnieAssuranceId;

    @NotBlank
    private String libelle;

    private String description;
    private Boolean actif;
}
