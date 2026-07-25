package com.assurance.dto.request;

import com.assurance.enums.ModeTarificationGarantie;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class UpsertLigneGrilleTarifaireRequest {
    private String id;

    @NotBlank
    private String garantieId;

    private String usageId;
    private String categorieTransportId;
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
