package com.assurance.dto.response;

import com.assurance.enums.TypeClient;
import com.assurance.enums.TypeContrat;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class PiecesJointesContratResponse {
    private Long contratId;
    private String numeroDossier;
    private String numeroPolice;
    private TypeContrat typeContrat;
    private TypeClient typeClient;
    private Long mouvementContratId;
    private String mouvementCode;
    private String mouvementLibelle;
    private List<TypePieceJointeResponse> types;
    private List<PieceJointeResponse> pieces;
}
