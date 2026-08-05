package com.assurance.dto.response;

import com.assurance.enums.NiveauEcartAffectation;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
public class LotAffectationQuittanceResponse {
    private List<AffectationQuittanceResponse> quittances;
    private List<AffectationQuittanceResponse.Ligne> lignes;
    private BigDecimal montantTtcAttendu;
    private BigDecimal montantTtcAffecte;
    private BigDecimal ecart;
    private boolean equilibre;
    private BigDecimal seuilAvertissementEcart;
    private BigDecimal seuilBlocageEcart;
    private NiveauEcartAffectation niveauEcart;
    private boolean validationAutorisee;
}
