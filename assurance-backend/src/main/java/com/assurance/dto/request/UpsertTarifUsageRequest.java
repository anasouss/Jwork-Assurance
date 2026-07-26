package com.assurance.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class UpsertTarifUsageRequest {
    @NotBlank
    private String usageId;

    private String categorieTransportId;
    private BigDecimal puissanceFiscaleMin;
    private BigDecimal puissanceFiscaleMax;
    private BigDecimal nombrePlacesMin;
    private BigDecimal nombrePlacesMax;
    private BigDecimal ptcMin;
    private BigDecimal ptcMax;
    private String sousClasse;
    private String carburantId;
    private String carburant;
    private BigDecimal primeNette;
    private BigDecimal primeParPlace;
    private Boolean actif;
}
