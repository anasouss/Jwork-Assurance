package com.assurance.dto.response;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class SinistreIntervenantResponse {
    private Long id;
    private String code;
    private String nom;
    private String telephone;
    private String email;
    private String adresse;
    private Long villeId;
    private String ville;
    private boolean actif;
}
