package com.assurance.dto.response;

import com.assurance.enums.OrigineDelaiPaiement;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDate;

@Getter
@Builder
public class PropositionEcheanceDocumentClientResponse {
    private LocalDate dateEmission;
    private Integer delaiJours;
    private LocalDate dateEcheanceProposee;
    private OrigineDelaiPaiement origine;
    private Long conditionPaiementId;
    private LocalDate dateFinCondition;
    private boolean justificatifPresent;
}
