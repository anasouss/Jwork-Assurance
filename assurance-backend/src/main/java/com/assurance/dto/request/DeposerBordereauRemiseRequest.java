package com.assurance.dto.request;

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

    @Size(max = 120)
    private String referenceBancaire;
}
