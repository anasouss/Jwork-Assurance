package com.assurance.dto.response;

import com.assurance.entity.Agence;
import com.assurance.enums.StatutAgence;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AdminAgenceResponse {
    private Long id;
    private String code;
    private String nom;
    private String adresse;
    private String ville;
    private String telephone;
    private String fax;
    private String email;
    private boolean logoDisponible;
    private StatutAgence statut;

    public static AdminAgenceResponse from(Agence agence) {
        return AdminAgenceResponse.builder()
                .id(agence.getId())
                .code(agence.getCode())
                .nom(agence.getNom())
                .adresse(agence.getAdresse())
                .ville(agence.getVille())
                .telephone(agence.getTelephone())
                .fax(agence.getFax())
                .email(agence.getEmail())
                .logoDisponible(agence.getLogoContenu() != null && agence.getLogoContenu().length > 0)
                .statut(agence.getStatut())
                .build();
    }
}
