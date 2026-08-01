package com.assurance.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CancelAttestationStockRequest {

    @NotBlank(message = "Le motif d'annulation est obligatoire")
    @Size(max = 1000, message = "Le motif d'annulation ne peut pas depasser 1000 caracteres")
    private String motif;
}
