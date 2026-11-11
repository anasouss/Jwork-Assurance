package com.assurance.dto.response;

import com.assurance.enums.ModeReglementConvention;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record ConventionProductionResponse(List<Row> rows, long totalElements, int totalPages, int page) {
    public record Row(Long id, String convention, String numeroQuittance, String compagnie, String numeroPolice,
                      String mouvement, String assure, String vehicule, LocalDate dateEffet, LocalDate dateExpiration,
                      BigDecimal primeNette, BigDecimal taxes, BigDecimal montantTtc,
                      ModeReglementConvention mode, BigDecimal montantClient) {
    }
}
