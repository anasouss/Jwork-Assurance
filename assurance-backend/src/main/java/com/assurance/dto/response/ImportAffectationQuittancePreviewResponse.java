package com.assurance.dto.response;

import com.assurance.enums.NiveauEcartAffectation;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
public class ImportAffectationQuittancePreviewResponse {
    private String fichier;
    private int lignesLues;
    private List<AffectationQuittanceResponse.Ligne> lignes;
    private List<String> erreurs;
    private BigDecimal primeNette;
    private BigDecimal montantTaxes;
    private BigDecimal accessoires;
    private BigDecimal montantTtc;
    private BigDecimal commissionNette;
    private BigDecimal netCompagnie;
    private BigDecimal ecart;
    private boolean equilibre;
    private BigDecimal seuilAvertissementEcart;
    private BigDecimal margeManquanteMaximale;
    private BigDecimal margeDepassementMaximale;
    private NiveauEcartAffectation niveauEcart;
    private boolean validationAutorisee;
}
