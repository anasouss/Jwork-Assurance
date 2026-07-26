package com.assurance.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

@Data
public class UpsertCategorieClientRequest {
    @NotBlank
    private String code;

    @NotBlank
    private String libelle;

    private List<Long> usageIds;
    private Boolean actif;
}
