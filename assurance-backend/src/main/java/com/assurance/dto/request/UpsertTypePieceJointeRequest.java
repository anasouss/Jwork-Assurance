package com.assurance.dto.request;

import com.assurance.enums.TypeAssistance;
import com.assurance.enums.TypeClient;
import com.assurance.enums.TypeContrat;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class UpsertTypePieceJointeRequest {

    @NotBlank
    private String libelle;

    private Long naturePieceJointeId;
    private Long brancheAssuranceId;
    private TypeAssistance typeAssistance;
    private TypeContrat typeContrat;
    private TypeClient typeClient;
    private Long typeMouvementId;
    private Boolean obligatoire;
    private Boolean actif;
    private Integer ordreAffichage;
}
