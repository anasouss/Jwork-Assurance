package com.assurance.dto.response;

import com.assurance.enums.StatutAgence;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
@Builder
public class PlatformDashboardResponse {
    private LocalDate dateDu;
    private LocalDate dateAu;
    private Long agenceId;
    private Summary summary;
    private List<AgencyRow> agencies;

    @Data
    @Builder
    public static class Summary {
        private long totalAgencies;
        private long activeAgencies;
        private long displayedAgencies;
        private long activeUsers;
        private long activeContracts;
        private long quittances;
        private BigDecimal primeNette;
        private BigDecimal taxes;
        private BigDecimal primeTotale;
    }

    @Data
    @Builder
    public static class AgencyRow {
        private Long id;
        private String code;
        private String nom;
        private String ville;
        private StatutAgence statut;
        private long activeUsers;
        private long activeContracts;
        private long quittances;
        private BigDecimal primeNette;
        private BigDecimal taxes;
        private BigDecimal primeTotale;
    }
}
