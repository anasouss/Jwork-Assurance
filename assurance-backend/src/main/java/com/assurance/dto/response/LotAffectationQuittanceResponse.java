package com.assurance.dto.response;

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
}
