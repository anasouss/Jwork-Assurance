package com.assurance.dto.request;

import com.assurance.enums.NatureSinistre;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

@Data
public class CreateSinistreRequest {

    @NotNull
    private Long contratId;

    private Long vehiculeId;

    @NotNull
    private NatureSinistre nature;

    @NotNull
    private LocalDate dateSinistre;

    private LocalTime heureSinistre;

    @NotNull
    private LocalDate dateDeclaration;

    private Long villeId;

    @Size(max = 500)
    private String lieu;

    @Size(max = 4000)
    private String circonstances;

    private List<Long> garantieIds;

    private Boolean declarer;
}
