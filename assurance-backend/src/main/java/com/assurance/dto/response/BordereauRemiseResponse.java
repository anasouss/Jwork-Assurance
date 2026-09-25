package com.assurance.dto.response;

import com.assurance.enums.ModeReglementClient;
import com.assurance.enums.StatutBordereauRemise;
import com.assurance.enums.StatutLigneBordereauRemise;
import com.assurance.enums.TypeBordereauRemise;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BordereauRemiseResponse {
    private Long id;
    private String numero;
    private TypeBordereauRemise type;
    private StatutBordereauRemise statut;
    private LocalDate dateBordereau;
    private LocalDate dateDepot;
    private Long compteDestinationId;
    private String compteDestination;
    private Long compteSourceId;
    private String compteSource;
    private BigDecimal montantTotal;
    private String referenceBancaire;
    private String notes;
    private Long operationTresorerieId;
    private int nombreLignes;
    private LocalDateTime createdAt;
    private List<Ligne> lignes;

    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Ligne {
        private Long id;
        private Long instrumentId;
        private Long reglementId;
        private String numeroReglement;
        private String payeur;
        private ModeReglementClient mode;
        private String referenceInstrument;
        private String banqueEmettrice;
        private LocalDate dateReception;
        private LocalDate dateEcheance;
        private BigDecimal montant;
        private StatutLigneBordereauRemise statut;
        private LocalDate dateTraitement;
        private String motifRejet;
    }
}
