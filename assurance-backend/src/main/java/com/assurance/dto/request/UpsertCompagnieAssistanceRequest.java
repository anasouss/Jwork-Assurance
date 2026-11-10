package com.assurance.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpsertCompagnieAssistanceRequest {
    @NotBlank
    private String code;

    @NotBlank
    private String nom;

    @Size(max = 80)
    private String nomAbrege;

    private String email;
    private String telephone;
    private Boolean actif;
}
