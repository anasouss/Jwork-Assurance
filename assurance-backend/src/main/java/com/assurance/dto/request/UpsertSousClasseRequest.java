package com.assurance.dto.request;

import com.assurance.enums.ChampMoteurSousClasse;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class UpsertSousClasseRequest {

    @NotBlank
    private String code;

    @NotBlank
    private String libelle;

    @NotNull
    private ChampMoteurSousClasse champMoteur;

    private Boolean conducteurPermisRequis;
    private Boolean actif;
}
