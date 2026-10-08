package com.assurance.dto.request;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class UpsertUsageRequest {
    @NotBlank
    private String code;

    @NotBlank
    private String libelle;

    private String criteria;
    private Long groupeUsageAttestationId;
    private Boolean consommeAttestation;
    private Boolean byCarburantAndPf;
    private Boolean bySousClasse;
    private Boolean byPtc;
    private Boolean byPrime;
    private Boolean byCategorieTransport;
    private Boolean garantiesPersonne;

    @DecimalMin("0")
    @DecimalMax("100")
    private BigDecimal tauxExtensionRemorque;

    private Boolean actif;
}
