package com.assurance.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
@Builder
public class QuittanceResponse {
    private Long id;
    private Long contratId;
    private String numeroContrat;
    private Long mouvementContratId;
    private String codeMouvement;
    private String typeImpactMouvement;
    private Long elementFacturableId;
    private String numeroQuittance;
    private String type;
    private String categorie;
    private Boolean globale;
    private LocalDate dateDebut;
    private LocalDate dateFin;
    private BigDecimal primeNette;
    private BigDecimal taxe;
    private BigDecimal taxeParafiscale;
    private BigDecimal accessoire;
    private BigDecimal cnpac;
    private BigDecimal primeTotale;
    private List<Ligne> lignes;

    @Data
    @Builder
    public static class Ligne {
        private String categorie;
        private Integer ordre;
        private Boolean globale;
        private BigDecimal primeNette;
        private BigDecimal taxe;
        private BigDecimal taxeParafiscale;
        private BigDecimal accessoire;
        private BigDecimal cnpac;
        private BigDecimal primeTotale;
    }
}
