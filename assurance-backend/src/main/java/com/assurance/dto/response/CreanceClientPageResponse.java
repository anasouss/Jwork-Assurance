package com.assurance.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.util.List;

@Getter
@Builder
public class CreanceClientPageResponse {
    private Summary summary;
    private SourceDocumentClientPageResponse.PageInfo page;
    private List<Ligne> rows;

    @Getter
    @Builder
    public static class Summary {
        private long total;
        private BigDecimal montantInitial;
        private BigDecimal montantConfirme;
        private BigDecimal montantEnAttente;
        private BigDecimal soldeOuvert;
    }

    @Getter
    @Builder
    public static class Ligne {
        private SourceDocumentClientResponse source;
        private BigDecimal montantConfirme;
        private BigDecimal montantEnAttente;
        private BigDecimal soldeOuvert;
        private String statut;
    }
}
