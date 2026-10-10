package com.assurance.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.util.Set;

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
    private Long sousClasseId;
    private Set<Long> carburantIds;
    private BigDecimal primeNette;
    private BigDecimal primeParPlace;
    private Boolean actif;
}
