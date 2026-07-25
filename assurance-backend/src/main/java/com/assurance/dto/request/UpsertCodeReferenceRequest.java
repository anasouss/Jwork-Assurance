package com.assurance.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class UpsertCodeReferenceRequest {
    @NotBlank
    private String code;

    @NotBlank
    private String libelle;

    private Boolean actif;
}
