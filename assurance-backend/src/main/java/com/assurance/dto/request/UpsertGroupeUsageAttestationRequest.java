package com.assurance.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

@Data
public class UpsertGroupeUsageAttestationRequest {
    @NotBlank
    private String code;

    @NotBlank
    private String libelle;

    private String couleur;
    private List<Long> compagnieRestrictionIds;
    private Boolean visibleStock;
    private Boolean actif;
}
