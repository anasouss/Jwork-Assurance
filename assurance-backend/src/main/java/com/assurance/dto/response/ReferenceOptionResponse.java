package com.assurance.dto.response;

import com.assurance.enums.ChampMoteurSousClasse;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ReferenceOptionResponse {
    private Long id;
    private String code;
    private String libelle;
    private String description;
    private Boolean actif;
    private Long compagnieAssuranceId;
    private String compagnieAssuranceLibelle;
    private ChampMoteurSousClasse champMoteur;
    private Boolean conducteurPermisRequis;
    private Boolean assistanceAutorisee;
}
