package com.assurance.dto.request;

import com.assurance.enums.StatutSinistre;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class TransitionSinistreRequest {

    @NotNull
    private StatutSinistre statut;

    @Size(max = 500)
    private String motif;
}
