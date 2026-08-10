package com.assurance.dto.response;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class UtilisateurTresorerieResponse {
    private Long id;
    private String nomComplet;
    private String email;
    private String role;
    private Boolean actif;
}
