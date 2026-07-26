package com.assurance.dto.response;

import com.assurance.enums.TypeContrat;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
@Builder
public class AssistanceContratContextResponse {
    private Long contratId;
    private String numeroDossier;
    private String numeroPolice;
    private TypeContrat typeContrat;
    private LocalDate dateEffet;
    private LocalDate dateEcheance;
    private String echeanceCode;
    private Long mouvementContratId;
    private String mouvementCode;
    private String mouvementLibelle;
    private Long categorieClientId;
    private List<VehiculeAssistanceOption> vehiculesEligibles;
    private List<AssistanceContratResponse> assistances;
    private List<CompagnieAssistanceOption> compagnies;
    private List<ProduitAssistanceOption> produits;

    @Data
    @Builder
    public static class VehiculeAssistanceOption {
        private Long id;
        private String immatriculation;
        private Long usageId;
        private String usageCode;
        private String usageLibelle;
        private LocalDate dateEffet;
        private LocalDate dateEcheance;
    }

    @Data
    @Builder
    public static class CompagnieAssistanceOption {
        private Long id;
        private String code;
        private String libelle;
    }

    @Data
    @Builder
    public static class ProduitAssistanceOption {
        private Long id;
        private String libelle;
        private String type;
        private Long compagnieAssistanceId;
        private Long categorieClientId;
        private List<Long> usageIds;
        private String prestations;
        private Long tarifProduitAssistanceId;
        private LocalDate dateDebutTarif;
        private LocalDate dateFinTarif;
        private BigDecimal montantHt;
        private BigDecimal montantTtc;
    }
}
