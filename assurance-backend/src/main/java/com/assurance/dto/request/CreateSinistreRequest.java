package com.assurance.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;
import java.util.List;

@Data
public class CreateSinistreRequest {

    @NotNull
    private Long contratId;

    private Long vehiculeId;

    @NotNull
    private LocalDate dateSinistre;

    @NotNull
    private LocalDate dateDeclaration;

    private List<Long> garantieIds;

    @Size(max = 20)
    private List<@NotNull Long> assistanceIds;

    private Boolean declarer;

    @Size(max = 100)
    private String referenceCompagnie;

    @jakarta.validation.constraints.DecimalMin("0")
    @jakarta.validation.constraints.DecimalMax("100")
    private java.math.BigDecimal tauxResponsabilite;

    private com.assurance.enums.TypeDommageSinistre typeDommage;

    private com.assurance.enums.ModeReparationSinistre modeReparation;

    private Long garageId;

    @jakarta.validation.Valid
    private UpsertMissionExpertiseRequest expertInitial;
}
