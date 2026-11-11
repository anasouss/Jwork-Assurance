package com.assurance.dto.request;

import com.assurance.enums.Fractionnement;
import com.assurance.enums.TypeEcheanceConvention;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;
import java.util.List;

@Data
public class UpsertConventionRequest {
    @NotNull
    private Long compagnieAssuranceId;

    @jakarta.validation.constraints.NotBlank
    private String code;

    @jakarta.validation.constraints.NotBlank
    private String intitule;

    private String description;
    private String organismeConventionne;
    private LocalDate dateEffet;
    private LocalDate dateEcheance;

    @NotNull
    private TypeEcheanceConvention typeEcheance;

    private String echeance;
    private Fractionnement fractionnement;

    @NotNull
    private Long categorieClientId;

    @NotNull
    private Long grilleTarifaireId;

    private List<Long> usageIds;
    private Boolean actif;
}
