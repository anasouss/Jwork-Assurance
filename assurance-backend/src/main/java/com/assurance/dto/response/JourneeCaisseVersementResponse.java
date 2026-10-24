package com.assurance.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Getter
@Builder
public class JourneeCaisseVersementResponse {
    private String cle;
    private Long compteTresorerieId;
    private String compteTresorerie;
    private String caissier;
    private LocalDate dateJournee;
    private int nombreEncaissements;
    private BigDecimal montantAVerser;
    private List<Long> mouvementIds;
}
