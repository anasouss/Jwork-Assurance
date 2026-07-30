package com.assurance.dto.request;

import com.assurance.enums.CategorieQuittance;
import com.assurance.enums.SourceAffectationQuittance;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Data
public class EnregistrerAffectationQuittanceRequest {
    @NotNull
    private SourceAffectationQuittance source;
    @NotNull
    private Boolean avecRetenue;
    private String numeroQuittanceCompagnie;
    private String fichierSource;
    @Valid
    private List<Ligne> lignes = new ArrayList<>();

    @Data
    public static class Ligne {
        @NotBlank
        private String numeroQuittanceCompagnie;
        @NotNull
        private LocalDate dateEffet;
        private LocalDate dateEcheance;
        private String acteSource;
        private String categorieSource;
        private CategorieQuittance categorieQuittance;
        private String statutSource;
        @NotNull
        private BigDecimal primeNette;
        @NotNull
        private BigDecimal montantTaxes;
        @NotNull
        private BigDecimal accessoires;
        @NotNull
        private BigDecimal montantTtc;
        @NotNull
        private BigDecimal commissionNette;
    }
}
