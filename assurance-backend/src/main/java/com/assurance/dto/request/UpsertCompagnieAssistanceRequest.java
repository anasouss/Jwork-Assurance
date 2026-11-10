package com.assurance.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpsertCompagnieAssistanceRequest {
    // Accepted for older callers; internal codes are now generated and preserved server-side.
    @Size(max = 80)
    private String code;

    @Size(max = 80)
    private String codeIntermediaire;

    @NotBlank
    private String nom;

    @Size(max = 80)
    private String nomAbrege;

    private String email;
    private String telephone;
    private Boolean actif;
}
