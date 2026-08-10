package com.assurance.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class GrilleTarifaireCatalogueResponse {
    private Long id;
    private String libelle;
    private String description;
    private Boolean actif;
    private Long compagnieAssuranceId;
    private String compagnieAssuranceCode;
    private String compagnieAssuranceLibelle;
    private List<ReferenceSummary> conventions;
    private List<ReferenceSummary> usages;
    private long nombreLignes;
    private long nombreFormulesPersonne;
    private LocalDateTime updatedAt;

    @Data
    @Builder
    public static class ReferenceSummary {
        private Long id;
        private String code;
        private String libelle;
    }
}
