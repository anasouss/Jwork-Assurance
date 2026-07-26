package com.assurance.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class UpsertTarifUsageRequest {
    @NotNull
    private Long usageId;

    private Long categorieTransportId;
    private BigDecimal puissanceFiscaleMin;
    private BigDecimal puissanceFiscaleMax;
    private BigDecimal nombrePlacesMin;
    private BigDecimal nombrePlacesMax;
    private BigDecimal ptcMin;
    private BigDecimal ptcMax;
    private String sousClasse;
    private Long carburantId;
    private String carburant;
    private BigDecimal primeNette;
    private BigDecimal primeParPlace;
    private Boolean actif;
}
