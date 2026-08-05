package com.assurance.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class UpdateContactCompagnieStatusRequest {

    @NotNull(message = "Le statut est obligatoire")
    private Boolean actif;
}
