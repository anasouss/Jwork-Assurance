package com.assurance.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class UpsertCategorieTransportRequest {
    @NotBlank
    private String code;

    @NotBlank
    private String libelle;

    private String description;
    private Boolean actif;
}
