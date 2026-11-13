package com.assurance.dto.request;

import com.assurance.enums.TypePrestataireSinistre;
import jakarta.validation.constraints.*;
import lombok.Data;

import java.util.List;

@Data
public class UpsertSpecialitePrestataireRequest {
    @NotBlank
    @Size(max = 40)
    private String code;

    @NotBlank
    @Size(max = 180)
    private String libelle;

    @NotNull
    private TypePrestataireSinistre typePrestataire;

    private boolean actif = true;

    @NotNull
    @Size(min = 1, max = 200)
    private List<@NotNull Long> garantieIds;
}
