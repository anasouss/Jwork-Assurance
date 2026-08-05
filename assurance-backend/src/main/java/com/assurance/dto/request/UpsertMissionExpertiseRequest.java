package com.assurance.dto.request;

import com.assurance.enums.StatutMissionExpertise;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class UpsertMissionExpertiseRequest {

    @NotNull
    private Long expertId;

    private Long garageId;

    @Size(max = 100)
    private String referenceMission;

    @NotNull
    private LocalDate dateMission;

    private LocalDate dateRapport;

    @DecimalMin("0")
    private BigDecimal montantEstime;

    @DecimalMin("0")
    private BigDecimal montantAccepte;

    @NotNull
    private StatutMissionExpertise statut;

    @Size(max = 1000)
    private String notes;
}
