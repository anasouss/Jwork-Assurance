package com.assurance.dto.request;

import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.NotEmpty;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.util.List;

@Getter
@Setter
public class CreerFactureConventionRequest {

    @NotEmpty(message = "Sélectionnez au moins une échéance")
    private List<Long> echeanceIds;

    @FutureOrPresent(message = "La date d'échéance ne peut pas être passée")
    private LocalDate dateEcheance;

    private String notes;
}
