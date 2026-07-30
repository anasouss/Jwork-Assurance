package com.assurance.dto.response;

import com.assurance.enums.ModeAffectationQuittance;
import com.assurance.enums.ModeCalculCommission;
import com.assurance.enums.ModeVentilationQuittance;
import com.assurance.enums.TypeContrat;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@Builder
public class RegleAffectationQuittanceResponse {
    private Long id;
    private Long compagnieAssuranceId;
    private String compagnie;
    private TypeContrat typeContrat;
    private ModeAffectationQuittance modeAffectation;
    private ModeVentilationQuittance modeVentilation;
    private ModeCalculCommission modeCalculCommission;
    private BigDecimal tauxCommissionAutomobile;
    private BigDecimal tauxCommissionEvcat;
    private BigDecimal tauxCommissionCorporel;
    private BigDecimal tauxTvaIncluseCommission;
    private Boolean retenueParDefaut;
    private BigDecimal tauxRetenue;
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
    private String excelColonneActe;
    private String excelColonneCategorie;
    private String excelColonneStatut;
    private Boolean actif;
}
