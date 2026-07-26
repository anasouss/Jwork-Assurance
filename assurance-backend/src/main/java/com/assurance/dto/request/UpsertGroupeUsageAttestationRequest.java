package com.assurance.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class UpsertGroupeUsageAttestationRequest {
    @NotBlank
    private String code;

    @NotBlank
    private String libelle;

    private String couleur;
    private String restrictionCompagnie;
    private Boolean visibleStock;
    private Boolean actif;
}
