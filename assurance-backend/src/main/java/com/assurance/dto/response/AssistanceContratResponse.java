package com.assurance.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
@Builder
public class AssistanceContratResponse {
    private Long brancheAssuranceId;
    private String brancheAssuranceCode;
    private String brancheAssuranceLibelle;
    private String typeAssistance;
    private Long id;
    private Long contratId;
    private Long assistanceOrigineId;
    private Long mouvementContratId;
    private Long vehiculeId;
    private String vehiculeImmatriculation;
    private Long compagnieAssistanceId;
    private String compagnieAssistanceLibelle;
    private Long produitAssistanceId;
    private Long tarifProduitAssistanceId;
    private String produit;
    private String libelleReleve;
    private LocalDate dateSouscription;
    private LocalDate dateEffet;
    private LocalDate dateEcheance;
    private String echeanceCode;
    private String numeroContratOuQuittance;
    private Integer duree;
    private String unite;
    private String codePromo;
    private BigDecimal montantReduction;
    private Integer trimestres;
    private BigDecimal prorataRatio;
    private BigDecimal primeNette;
    private BigDecimal primeTotale;
    private Long elementFacturableId;
    private List<LigneTarification> lignesTarification;

    @Data
    @Builder
    public static class LigneTarification {
        private Long assureId;
        private String assureNom;
        private Integer age;
        private Integer dureeTarifMois;
        private Integer ageMin;
        private Integer ageMax;
        private BigDecimal primeNette;
        private BigDecimal primeTotale;
        private BigDecimal montantReduction;
    }
}
