package com.assurance.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
public class AvenantDraftSummaryResponse {
    private Long id;
    private Long contratId;
    private String codeTypeMouvement;
    private String libelleTypeMouvement;
    private LocalDate dateEffet;
    private LocalDate dateEcheance;
    private LocalDateTime updatedAt;
}
