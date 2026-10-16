package com.assurance.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
public class DeposerBordereauRemiseRequest {

    @NotNull
    private LocalDate dateDepot;

    @NotBlank(message = "Le numéro du bordereau bancaire est obligatoire")
    @Size(max = 120)
    private String referenceBancaire;
}
