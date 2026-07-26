package com.assurance.dto.response;

import com.assurance.enums.TypeClient;
import com.assurance.enums.TypeContrat;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class TypePieceJointeResponse {
    private Long id;
    private String libelle;
    private TypeContrat typeContrat;
    private TypeClient typeClient;
    private Long typeMouvementId;
    private String typeMouvementCode;
    private String typeMouvementLibelle;
    private Boolean obligatoire;
    private Boolean actif;
    private Integer ordreAffichage;
}
