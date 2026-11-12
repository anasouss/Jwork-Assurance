package com.assurance.dto.request;

import com.assurance.enums.PeriodeCouverture;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.util.Set;

@Data
public class UpsertUsageRequest {
    @NotBlank
    private String code;

    @NotBlank
    private String libelle;

    private String criteria;
    private Boolean fermeUniquement;
    private Set<@NotNull PeriodeCouverture> periodesAutorisees;
    private Long groupeUsageAttestationId;
    private Boolean consommeAttestation;
    private Boolean byCarburant;
    private Boolean byPuissanceFiscale;
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
