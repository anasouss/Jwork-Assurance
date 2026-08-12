package com.assurance.dto.response;

import com.assurance.dto.request.ConfigurationImportReleveBancaireRequest;
import com.assurance.enums.FormatReleveBancaire;
import com.assurance.enums.StatutImportReleveBancaire;
import com.assurance.enums.StatutLigneReleveBancaire;
import com.assurance.enums.StatutRapprochementBancaire;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Getter
@Builder
public class ImportReleveBancaireResponse {
    private Long id;
    private Long compteTresorerieId;
    private String compteTresorerie;
    private String nomFichier;
    private FormatReleveBancaire format;
    private StatutImportReleveBancaire statut;
    private ConfigurationImportReleveBancaireRequest configuration;
    private boolean configurationComplete;
    private List<String> entetes;
    private List<Map<String, String>> apercu;
    private BigDecimal soldeOuverture;
    private BigDecimal soldeCloture;
    private BigDecimal totalDebits;
    private BigDecimal totalCredits;
    private Integer nombreLignes;
    private LocalDateTime createdAt;
    private LocalDateTime valideLe;
    private List<Ligne> lignes;

    @Getter
    @Builder
    public static class Ligne {
        private Long id;
        private Integer numeroLigne;
        private LocalDate dateOperation;
        private LocalDate dateValeur;
        private String libelle;
        private String referenceBancaire;
        private String contrepartie;
        private String compteContrepartie;
        private BigDecimal debit;
        private BigDecimal credit;
        private BigDecimal solde;
        private StatutLigneReleveBancaire statut;
        private List<Rapprochement> rapprochements;
        private List<Suggestion> suggestions;
    }

    @Getter
    @Builder
    public static class Rapprochement {
        private Long id;
        private Long instrumentId;
        private String numeroReglement;
        private String payeur;
        private String mode;
        private String referenceInstrument;
        private BigDecimal montantInstrument;
        private BigDecimal montant;
        private Integer score;
        private String motif;
        private StatutRapprochementBancaire statut;
    }

    @Getter
    @Builder
    public static class Suggestion {
        private Long instrumentId;
        private String numeroReglement;
        private String payeur;
        private String mode;
        private String referenceInstrument;
        private LocalDate dateInstrument;
        private BigDecimal montant;
        private Integer score;
        private String motif;
    }
}
