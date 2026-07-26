package com.assurance.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@Builder
public class CarteVerteResponse {
    private Long id;
    private Long contratId;
    private Long mouvementContratId;
    private Long vehiculeId;
    private String vehiculeImmatriculation;
    private String numero;
    private LocalDate dateEffet;
    private LocalDate dateEcheance;
    private String numeroPoliceContrat;
    private String numeroDossier;
    private BigDecimal montant;
    private Long elementFacturableId;
}
