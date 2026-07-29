package com.assurance.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class UpsertGroupeClientRequest {
    @NotBlank
    private String code;

    @NotBlank
    private String libelle;

    private Long clientTeteId;
    private Long clientTresorerieId;
    private Boolean facturationConsolideeDefaut;
    private Boolean actif;
}
