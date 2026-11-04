package com.assurance.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder(toBuilder = true)
public class PieceJointeResponse {
    private Long id;
    private Long clientId;
    private String ownerName;
    private Long vehiculeId;
    private Long naturePieceJointeId;
    private Long previousVersionId;
    private com.assurance.enums.DocumentOwner documentOwner;
    private java.time.LocalDate expiresOn;
    private Boolean archived;
    private String status;
    private String changeReason;
    private String createdBy;
    private Boolean canDelete;
    private Boolean canUnlink;
    private com.assurance.enums.DocumentOwner expectedOwner;
    private String archivedBy;
    private LocalDateTime archivedAt;
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
