package com.assurance.dto.request;

import com.assurance.enums.ModeAffectationQuittance;
import com.assurance.enums.ModeCalculCommission;
import com.assurance.enums.ModeVentilationQuittance;
import com.assurance.enums.TypeContrat;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class UpsertRegleAffectationQuittanceRequest {
    @NotNull
    private Long compagnieAssuranceId;
    @NotNull
    private TypeContrat typeContrat;
    @NotNull
    private ModeAffectationQuittance modeAffectation;
    @NotNull
    private ModeVentilationQuittance modeVentilation;
    @NotNull
    private ModeCalculCommission modeCalculCommission;
    @NotNull
    @DecimalMin("0")
    private BigDecimal tauxCommissionAutomobile;
    @NotNull
    @DecimalMin("0")
    private BigDecimal tauxCommissionEvcat;
    @NotNull
    @DecimalMin("0")
    private BigDecimal tauxCommissionCorporel;
    @NotNull
    @DecimalMin("0")
    private BigDecimal tauxTvaIncluseCommission;
    @NotNull
    private Boolean retenueParDefaut;
    @NotNull
    @DecimalMin("0")
    private BigDecimal tauxRetenue;
    @NotNull
    @DecimalMin("0")
    private BigDecimal seuilAvertissementEcart;
    @NotNull
    @DecimalMin("0")
    private BigDecimal seuilBlocageEcart;
    @NotNull
    private LocalDate dateDebut;
    private LocalDate dateFin;
    private String excelFeuille;
    private Integer excelLigneEntete;
    private String excelColonneNumeroPolice;
    private String excelColonneNumeroQuittance;
    private String excelColonneDateEffet;
    private String excelColonneDateEcheance;
    private String excelColonnePrimeNette;
    private String excelColonneTaxes;
    private String excelColonneAccessoires;
    private String excelColonneMontantTtc;
    private String excelColonneCommissionNette;
    private String excelColonneNetCompagnie;
    private String excelColonneActe;
    private String excelColonneCategorie;
    private String excelColonneStatut;
    @NotNull
    private Boolean actif;
}
