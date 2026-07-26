package com.assurance.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;

@Data
public class UpsertAssistanceContratRequest {
    private Long mouvementContratId;

    @NotNull
    private Long vehiculeId;

    @NotNull
    private Long compagnieAssistanceId;

    @NotNull
    private Long produitAssistanceId;

    private LocalDate dateSouscription;
    private LocalDate dateEffet;
    private String echeanceCode;
    private String numeroContratOuQuittance;
    private String typeQuittance;
}
