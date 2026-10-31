package com.assurance.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
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

    @Size(max = 180)
    private String libelleReleve;
}
