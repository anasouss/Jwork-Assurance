package com.assurance.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@Builder
public class AssistanceContratResponse {
    private String id;
    private String contratId;
    private String mouvementContratId;
    private String vehiculeId;
    private String compagnieAssistanceId;
    private String produitAssistanceId;
    private String tarifProduitAssistanceId;
    private String produit;
    private LocalDate dateSouscription;
    private LocalDate dateEffet;
    private LocalDate dateEcheance;
    private String echeanceCode;
    private Integer trimestres;
    private BigDecimal prorataRatio;
    private BigDecimal primeNette;
    private BigDecimal primeTotale;
    private String elementFacturableId;
}
