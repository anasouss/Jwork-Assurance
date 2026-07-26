package com.assurance.dto.request;

import com.assurance.enums.ModeTarificationGarantie;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class UpsertLigneGrilleTarifaireRequest {
    private Long id;

    @NotNull
    private Long garantieId;

    private Long usageId;
    private Long categorieTransportId;
    private BigDecimal puissanceFiscaleMin;
    private BigDecimal puissanceFiscaleMax;
    private BigDecimal nombrePlacesMin;
    private BigDecimal nombrePlacesMax;
    private BigDecimal ptcMin;
    private BigDecimal ptcMax;
    private String sousClasse;
    private String carburant;
    private BigDecimal taux;
    private BigDecimal tauxFranchise;
    private BigDecimal franchiseMinimale;
    private BigDecimal prime;
    private BigDecimal capital;
    private String libelleOption;
    private Integer ordreAffichage;
    private ModeTarificationGarantie modeTarification;
    private Boolean actif;
}
