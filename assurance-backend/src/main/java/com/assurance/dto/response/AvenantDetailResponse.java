package com.assurance.dto.response;

import com.assurance.dto.request.AvenantRequest;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AvenantDetailResponse {
    private Long contratId;
    private ContratResponse.MouvementView mouvement;
    private AvenantRequest donneesEnregistrees;
    private QuittanceResponse impactFinancier;
}
