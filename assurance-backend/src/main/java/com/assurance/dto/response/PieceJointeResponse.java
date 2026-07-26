package com.assurance.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class PieceJointeResponse {
    private Long id;
    private Long contratId;
    private Long mouvementContratId;
    private Long typePieceJointeId;
    private String typePieceJointeLibelle;
    private Boolean obligatoire;
    private String nomFichier;
    private String contentType;
    private Long tailleOctets;
    private LocalDateTime createdAt;
}
