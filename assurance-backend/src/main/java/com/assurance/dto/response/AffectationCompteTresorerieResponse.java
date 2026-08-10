package com.assurance.dto.response;

import com.assurance.enums.NiveauAccesCompteTresorerie;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class AffectationCompteTresorerieResponse {
    private Long id;
    private Long utilisateurId;
    private String utilisateur;
    private String email;
    private NiveauAccesCompteTresorerie niveauAcces;
    private Boolean actif;
}
