package com.assurance.dto.response;

import com.assurance.enums.StatutDocumentClient;
import com.assurance.enums.TypeDocumentClient;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Getter
@Builder
public class DocumentClientResponse {
    private Long id;
    private TypeDocumentClient typeDocument;
    private StatutDocumentClient statut;
    private String numero;
    private LocalDate dateEmission;
    private LocalDate periodeDebut;
    private LocalDate periodeFin;
    private LocalDate dateEcheance;
    private Long clientPayeurId;
    private Long groupePayeurId;
    private String payeurNom;
    private String payeurIdentifiant;
    private String payeurAdresse;
    private BigDecimal totalDebit;
    private BigDecimal totalCredit;
    private BigDecimal totalDocument;
    private String notes;
    private LocalDateTime dateAnnulation;
    private String motifAnnulation;
    private List<Ligne> lignes;

    @Getter
    @Builder
    public static class Ligne {
        private Long id;
        private Long quittanceId;
        private Long contratId;
        private Long mouvementId;
        private Integer ordre;
        private LocalDate dateOperation;
        private LocalDate dateEcheance;
        private String numeroDossier;
        private String numeroPolice;
        private String numeroQuittance;
        private String mouvement;
        private String compagnie;
        private BigDecimal debit;
        private BigDecimal credit;
        private BigDecimal primeNette;
        private BigDecimal taxes;
        private BigDecimal accessoires;
        private BigDecimal montantTtc;
    }
}
