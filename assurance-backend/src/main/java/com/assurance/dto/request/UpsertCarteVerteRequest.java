package com.assurance.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;

@Data
public class UpsertCarteVerteRequest {
    private Long mouvementContratId;

    @NotNull
    private Long vehiculeId;

    @NotBlank
    private String numero;

    private LocalDate dateEffet;
}
