package com.assurance.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class UpsertCompagnieAssistanceRequest {
    @NotBlank
    private String code;

    @NotBlank
    private String nom;

    private String email;
    private String telephone;
    private Boolean actif;
}
