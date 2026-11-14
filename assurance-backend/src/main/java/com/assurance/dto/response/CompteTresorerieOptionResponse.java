package com.assurance.dto.response;

import com.assurance.enums.NatureCaisseTresorerie;
import com.assurance.enums.TypeCompteTresorerie;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class CompteTresorerieOptionResponse {
    private Long id;
    private String code;
    private String libelle;
    private TypeCompteTresorerie typeCompte;
    private NatureCaisseTresorerie natureCaisse;
    private Long utilisateurTitulaireId;
    private String utilisateurTitulaire;
    private Long banqueId;
    private String banqueCode;
    private String nomBanque;
    private String rib;
    private String devise;
    private Boolean actif;
}
