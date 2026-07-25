package com.assurance.dto.request;

import com.assurance.enums.Fractionnement;
import com.assurance.enums.TypeEcheanceConvention;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;
import java.util.List;

@Data
public class UpsertConventionRequest {
    @NotBlank
    private String compagnieAssuranceId;

    @NotBlank
    private String code;

    @NotBlank
    private String intitule;

    private String description;
    private String organismeConventionne;
    private LocalDate dateEffet;
    private LocalDate dateEcheance;

    @NotNull
    private TypeEcheanceConvention typeEcheance;

    private String echeance;
    private Fractionnement fractionnement;

    @NotBlank
    private String categorieClientId;

    @NotBlank
    private String grilleTarifaireId;

    private List<String> usageIds;
    private Boolean actif;
}
