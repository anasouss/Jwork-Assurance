package com.assurance.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record ConventionInvoicePreviewResponse(String convention, String payeur, LocalDate periodeDebut,
                                               LocalDate periodeFin, BigDecimal total, List<Line> lignes) {
    public record Line(String numeroQuittance, String numeroPolice, String compagnie, String mouvement,
                       String assure, String vehicule, LocalDate dateEffet, LocalDate dateExpiration,
                       BigDecimal montantBulletin, BigDecimal montantAPayer) {
    }
}
