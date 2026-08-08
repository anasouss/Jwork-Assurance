package com.assurance.dto.response;

import com.assurance.enums.ModeReglementCompagnie;
import com.assurance.enums.StatutInstrumentReglement;
import com.assurance.enums.StatutReglementCompagnie;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class ReglementCompagnieResponse {
    private Long id;
    private String numero;
    private Long compagnieId;
    private String compagnie;
    private LocalDate dateReglement;
    private StatutReglementCompagnie statut;
    private BigDecimal montantTotal;
    private BigDecimal montantNonAffecte;
    private String notes;
    private String creePar;
    private LocalDateTime dateAnnulation;
    private String motifAnnulation;
    private List<Instrument> instruments;

    @Data
    @Builder
    public static class Instrument {
        private Long id;
        private ModeReglementCompagnie mode;
        private StatutInstrumentReglement statut;
        private BigDecimal montant;
        private LocalDate dateInstrument;
        private LocalDate dateEcheance;
        private LocalDate dateStatut;
        private String referenceInstrument;
        private String banqueBeneficiaire;
        private String motifStatut;
        private Long compteTresorerieId;
        private String compteTresorerie;
        private List<Affectation> affectations;
    }

    @Data
    @Builder
    public static class Affectation {
        private Long bordereauId;
        private String numeroBordereau;
        private BigDecimal montant;
        private String statut;
    }
}
