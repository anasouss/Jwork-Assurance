package com.assurance.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RecalculHistoriqueFinancierResponse {

    private Long contratId;
    private String numeroDossier;
    private boolean applicable;
    private boolean applique;
    @Builder.Default
    private List<String> blocages = new ArrayList<>();
    @Builder.Default
    private List<Mouvement> mouvements = new ArrayList<>();
    private BigDecimal ancienTotal;
    private BigDecimal nouveauTotal;
    private BigDecimal ecartTotal;

    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Mouvement {
        private Long mouvementId;
        private String numeroMouvement;
        private String code;
        private String libelle;
        private LocalDate dateEffet;
        private Montants anciensMontants;
        private Montants nouveauxMontants;
        private boolean modifie;
    }

    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Montants {
        private BigDecimal primeNette;
        private BigDecimal taxe;
        private BigDecimal taxeParafiscale;
        private BigDecimal accessoire;
        private BigDecimal cnpac;
        private BigDecimal primeTotale;
    }
}
