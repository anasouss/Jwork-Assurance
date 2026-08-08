package com.assurance.dto.response;

import com.assurance.enums.BaseBordereauCompagnie;
import com.assurance.enums.ModeReglementCompagnie;
import com.assurance.enums.StatutBordereauCompagnie;
import com.assurance.enums.StatutInstrumentReglement;
import com.assurance.enums.StatutRapprochementCompagnie;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class BordereauCompagnieResponse {
    private Long id;
    private String numero;
    private Long compagnieId;
    private String compagnie;
    private BaseBordereauCompagnie baseBordereau;
    private StatutBordereauCompagnie statut;
    private StatutRapprochementCompagnie statutRapprochement;
    private String statutReglement;
    private LocalDate periodeDebut;
    private LocalDate periodeFin;
    private LocalDateTime dateValidation;
    private LocalDate dateTransmission;
    private String canalTransmission;
    private String referenceTransmission;
    private LocalDate dateAccuseReception;
    private String referenceAccuseReception;
    private BigDecimal primeNette;
    private BigDecimal montantTaxes;
    private BigDecimal accessoires;
    private BigDecimal montantTtc;
    private BigDecimal commissionNette;
    private BigDecimal montantRetenue;
    private BigDecimal netCompagnie;
    private BigDecimal montantRegle;
    private BigDecimal montantEnAttente;
    private BigDecimal soldeRestant;
    private BigDecimal ecartRapprochement;
    private String noteRapprochement;
    private String notes;
    private String creePar;
    private String validePar;
    private LocalDateTime dateAnnulation;
    private String motifAnnulation;
    private List<Ligne> lignes;
    private List<Reglement> reglements;

    @Data
    @Builder
    public static class Ligne {
        private Long id;
        private Long affectationId;
        private Integer ordre;
        private String numeroQuittanceCompagnie;
        private String numeroPolice;
        private String numeroDossier;
        private String mouvement;
        private LocalDate dateEffet;
        private LocalDate dateEcheance;
        private BigDecimal primeNette;
        private BigDecimal montantTaxes;
        private BigDecimal accessoires;
        private BigDecimal montantTtc;
        private BigDecimal commissionNette;
        private BigDecimal montantRetenue;
        private BigDecimal netCompagnie;
    }

    @Data
    @Builder
    public static class Reglement {
        private Long reglementId;
        private String numeroReglement;
        private Long instrumentId;
        private ModeReglementCompagnie mode;
        private StatutInstrumentReglement statut;
        private BigDecimal montant;
        private BigDecimal montantAffecte;
        private LocalDate dateInstrument;
        private LocalDate dateEcheance;
        private String referenceInstrument;
        private Long compteTresorerieId;
        private String compteTresorerie;
    }
}
