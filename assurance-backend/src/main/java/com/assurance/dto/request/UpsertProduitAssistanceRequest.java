package com.assurance.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.Set;

@Data
public class UpsertProduitAssistanceRequest {
    @NotNull
    private Long compagnieAssistanceId;

    private Long categorieClientId;

    @NotBlank
    private String libelle;

    private String type;
    private String prestations;
    private Set<Long> usageIds;
    private Boolean actif;
}
