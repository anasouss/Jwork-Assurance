package com.assurance.dto.response;

import java.time.LocalDate;

public record SinistreAssistanceResponse(Long id, String reference, String compagnie, String produit,
        LocalDate dateEffet, LocalDate dateEcheance) {
}
