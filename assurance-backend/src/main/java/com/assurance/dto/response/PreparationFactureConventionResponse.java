package com.assurance.dto.response;

import java.util.List;
import java.time.LocalDate;

public record PreparationFactureConventionResponse(String convention, LocalDate periodeDebut, LocalDate periodeFin, List<Ligne> lignes) {
    public record Ligne(Long echeanceId, Long payeurId, String payeurType, String payeurNom,
                        String blocage, List<ConventionInvoicePreviewResponse.Line> details) {
    }
}
