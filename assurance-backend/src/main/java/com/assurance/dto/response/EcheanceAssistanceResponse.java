package com.assurance.dto.response;

import com.assurance.enums.TypeContrat;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;
import java.util.List;

@Data
@Builder
public class EcheanceAssistanceResponse {
    private LocalDate dateDu;
    private LocalDate dateAu;
    private Long compagnieId;
    private Long produitId;
    private String typeAssistance;
    private String search;
    private Summary summary;
    private PageInfo page;
    private List<Row> rows;

    @Data
    @Builder
    public static class Summary {
        private long contratCount;
        private int compagnieCount;
    }

    @Data
    @Builder
    public static class PageInfo {
        private int number;
        private int size;
        private long totalElements;
        private int totalPages;
        private boolean first;
        private boolean last;
    }

    @Data
    @Builder
    public static class Row {
        private Long assistanceId;
        private Long contratId;
        private String dossier;
        private String client;
        private String codeClient;
        private String numeroContrat;
        private String typeAssistance;
        private String produit;
        private Long compagnieId;
        private String compagnie;
        private String immatriculation;
        private LocalDate dateEffet;
        private LocalDate dateEcheance;
        private String telephone;
        private String observation;
        private String observationNiveau;
        private boolean assistanceLiee;
        private TypeContrat typeContrat;
        private Long preTermeDraftId;
    }
}
