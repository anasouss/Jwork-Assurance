package com.assurance.dto.request;

import com.assurance.enums.TypeCompteTresorerie;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class UpsertCompteTresorerieRequest {
    @NotBlank
    @Size(max = 50)
    private String code;
    @NotBlank
    @Size(max = 160)
    private String libelle;
    @NotNull
    private TypeCompteTresorerie typeCompte;
    @Size(max = 160)
    private String nomBanque;
    @Size(max = 120)
    private String rib;
    private BigDecimal soldeInitial = BigDecimal.ZERO;
    private Boolean actif = true;
}
