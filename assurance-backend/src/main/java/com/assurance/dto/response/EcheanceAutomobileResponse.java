package com.assurance.dto.response;

import com.assurance.enums.TypeContrat;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;
import java.util.List;

@Data
@Builder
public class EcheanceAutomobileResponse {
    private LocalDate dateDu;
    private LocalDate dateAu;
    private Long compagnieId;
    private TypeContrat typeContrat;
    private String search;
    private Summary summary;
    private List<Row> rows;

    @Data
    @Builder
    public static class Summary {
        private int contratCount;
        private int compagnieCount;
    }

    @Data
    @Builder
    public static class Row {
        private Long contratId;
        private String dossier;
        private String client;
        private String codeClient;
        private String police;
        private String marque;
        private String matricule;
        private LocalDate dateEcheance;
        private TypeContrat typeContrat;
        private String typeContratLabel;
        private Long compagnieId;
        private String compagnie;
        private String telephone;
        private String observation;
    }
}
