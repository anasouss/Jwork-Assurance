package com.assurance.dto.request;

import com.assurance.enums.StatutSuiviRejetBancaire;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;

@Data
public class AjouterMouvementRejetRequest {
    @NotNull
    @PastOrPresent
    private LocalDate dateOperation;

    @NotNull
    private StatutSuiviRejetBancaire statut;

    @NotBlank
    @Size(max = 500)
    private String motif;
}
