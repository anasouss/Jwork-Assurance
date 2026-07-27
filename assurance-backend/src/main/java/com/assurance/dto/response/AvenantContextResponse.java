package com.assurance.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class AvenantContextResponse {
    private ContratResponse contrat;
    private List<ContratActionsResponse.MouvementDisponible> mouvementsDisponibles;
}
