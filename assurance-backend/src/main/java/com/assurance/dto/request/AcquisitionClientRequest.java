package com.assurance.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;

@Data
public class AcquisitionClientRequest {
    @NotNull
    private Long origineCommercialeId;

    private Long recommandeParUtilisateurId;
    private Long recommandeParClientId;
    private LocalDate dateAcquisition;

    @Size(max = 1000)
    private String notes;
}
