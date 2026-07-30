package com.assurance.dto.request;

import com.assurance.enums.TypeGarantie;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class UpsertGroupeExclusionGarantieRequest {
    @NotBlank
    private String code;

    @NotBlank
    private String libelle;

    private TypeGarantie typeGarantie;
    private Boolean actif;
}
