package com.assurance.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
@Builder
public class ElementFacturableResponse {
    private Long id;
    private Long contratId;
    private String numeroContrat;
    private Long mouvementContratId;
    private String codeMouvement;
    private String libelleMouvement;
    private Long compagnieAssuranceId;
    private String fractionnement;
    private Boolean splitAllowed;
    private Integer expectedSplitCount;
    private String nature;
    private String statut;
    private String referenceSource;
    private String libelle;
    private LocalDate dateDebut;
    private LocalDate dateFin;
    private BigDecimal primeNette;
    private BigDecimal taxe;
    private BigDecimal taxeParafiscale;
    private BigDecimal accessoire;
    private BigDecimal cnpac;
    private BigDecimal primeTotale;
    private List<QuittanceResponse.Ligne> lignesQuittance;
}
