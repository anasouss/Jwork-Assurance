package com.assurance.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.time.LocalDate;

@Data
public class MouvementContratRequest {

    @NotBlank
    private String codeTypeMouvement;

    private String numeroMouvement;

    private LocalDate dateEffet;

    private LocalDate dateEcheance;

    private String notes;
}
