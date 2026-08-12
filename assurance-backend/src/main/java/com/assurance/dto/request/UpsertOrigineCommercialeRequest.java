package com.assurance.dto.request;

import com.assurance.enums.TypeOrigineCommerciale;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpsertOrigineCommercialeRequest {
    @NotBlank
    @Size(max = 60)
    private String code;

    @NotBlank
    @Size(max = 160)
    private String libelle;

    @NotNull
    private TypeOrigineCommerciale type;

    private Boolean actif;
    private Integer ordre;
}
