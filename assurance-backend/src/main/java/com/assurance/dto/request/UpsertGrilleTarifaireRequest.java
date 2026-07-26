package com.assurance.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class UpsertGrilleTarifaireRequest {
    private Long agenceId;

    @NotNull
    private Long compagnieAssuranceId;

    @NotBlank
    private String libelle;

    private String description;
    private Boolean actif;
}
