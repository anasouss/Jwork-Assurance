package com.assurance.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
@Builder
public class DashboardResponse {
    private LocalDate dateDu;
    private LocalDate dateAu;
    private Kpis kpis;
    private Workload workload;
    private List<MonthlyProduction> productionMensuelle;
    private List<Breakdown> portefeuilleParType;
    private List<Breakdown> productionParCategorie;
    private List<RecentActivity> activitesRecentes;

    @Data
    @Builder
    public static class Kpis {
        private BigDecimal primeNette;
        private BigDecimal taxes;
        private BigDecimal primeTotale;
        private Long quittances;
        private Long mouvements;
        private Long contratsActifs;
        private Long contratsBrouillon;
        private Long clientsActifs;
    }

    @Data
    @Builder
    public static class Workload {
        private Long echeances30Jours;
        private Long quittancesAAffecter;
        private Long documentsAEmettre;
        private Long alertesStock;
        private Boolean controleStockActif;
    }

    @Data
    @Builder
    public static class MonthlyProduction {
        private Integer annee;
        private Integer mois;
        private String periode;
        private BigDecimal primeNette;
        private BigDecimal primeTotale;
        private Long quittances;
    }

    @Data
    @Builder
    public static class Breakdown {
        private String code;
        private String libelle;
        private BigDecimal montant;
        private Long nombre;
    }

    @Data
    @Builder
    public static class RecentActivity {
        private Long contratId;
        private Long mouvementId;
        private String numeroDossier;
        private String numeroPolice;
        private String typeContrat;
        private String mouvement;
        private String codeMouvement;
        private String compagnie;
        private LocalDate dateEffet;
        private BigDecimal primeTotale;
    }
}
