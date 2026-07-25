package com.assurance.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.time.LocalDate;

@Data
public class UpsertAssistanceContratRequest {
    private String mouvementContratId;

    @NotBlank
    private String vehiculeId;

    @NotBlank
    private String compagnieAssistanceId;

    @NotBlank
    private String produitAssistanceId;

    private LocalDate dateSouscription;
    private LocalDate dateEffet;
    private String echeanceCode;
    private String numeroContratOuQuittance;
    private String typeQuittance;
}
