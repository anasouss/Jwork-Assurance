package com.assurance.dto.response;

import com.assurance.enums.ModeReglementClient;
import com.assurance.enums.StatutAffectationReglement;
import com.assurance.enums.StatutInstrumentReglement;
import com.assurance.enums.StatutReglementClient;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Getter
@Builder
public class ReglementClientResponse {
    private Long id;
    private String numero;
    private LocalDate dateReglement;
    private Long clientPayeurId;
    private Long groupePayeurId;
    private String payeurNom;
    private StatutReglementClient statut;
    private BigDecimal montantTotal;
    private BigDecimal montantNonAffecte;
    private String notes;
    private String creePar;
    private List<Instrument> instruments;

    @Getter
    @Builder
    public static class Instrument {
        private Long id;
        private Long reglementId;
        private String numeroReglement;
        private String payeurNom;
        private ModeReglementClient mode;
        private StatutInstrumentReglement statut;
        private BigDecimal montant;
        private LocalDate dateInstrument;
        private LocalDate dateEcheance;
        private LocalDate dateStatut;
        private String referenceInstrument;
        private String banqueEmettrice;
        private String motifStatut;
        private Long compteTresorerieId;
        private String compteTresorerie;
        private List<Affectation> affectations;
    }

    @Getter
    @Builder
    public static class Affectation {
        private Long id;
        private Long elementFacturableId;
        private Long documentClientId;
        private BigDecimal montant;
        private StatutAffectationReglement statut;
    }
}
