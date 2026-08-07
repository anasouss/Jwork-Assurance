package com.assurance.dto.response;

import com.assurance.enums.Fractionnement;
import com.assurance.enums.StatutEcheanceFacturationConvention;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Getter
@Builder
public class EcheanceFacturationConventionPageResponse {
    private Summary summary;
    private PageInfo page;
    private List<Row> rows;

    @Getter
    @Builder
    public static class Summary {
        private long total;
        private long aFacturer;
        private long facturees;
        private BigDecimal montantAFacturer;
    }

    @Getter
    @Builder
    public static class PageInfo {
        private int number;
        private int size;
        private long totalElements;
        private int totalPages;
        private boolean first;
        private boolean last;
    }

    @Getter
    @Builder
    public static class Row {
        private Long id;
        private Long contratId;
        private Long documentId;
        private Long payeurId;
        private String payeurType;
        private String payeurNom;
        private String numeroDossier;
        private String numeroPolice;
        private Long compagnieId;
        private String compagnie;
        private Long conventionId;
        private String convention;
        private Fractionnement fractionnement;
        private Integer numeroPeriode;
        private Integer nombrePeriodes;
        private LocalDate periodeDebut;
        private LocalDate periodeFin;
        private LocalDate dateEcheance;
        private StatutEcheanceFacturationConvention statut;
        private BigDecimal primeNette;
        private BigDecimal taxes;
        private BigDecimal accessoires;
        private BigDecimal montantTtc;
    }
}
