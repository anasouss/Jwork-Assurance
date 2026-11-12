package com.assurance.dto.request;

import com.assurance.enums.EtapeSuiviSinistre;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class TransitionEtapeSinistreRequest {
    @NotNull
    private EtapeSuiviSinistre etapeSuivi;

    @Size(max = 500)
    private String motif;

    private Long version;
}
