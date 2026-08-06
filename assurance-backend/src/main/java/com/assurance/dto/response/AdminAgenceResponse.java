package com.assurance.dto.response;

import com.assurance.entity.Agence;
import com.assurance.enums.StatutAgence;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;

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
    private String identifiantFiscal;
    private String patente;
    private String ice;
    private String numeroAgrement;
    private LocalDate dateAgrement;
    private String banque;
    private String rib;
    private boolean logoDisponible;
    private boolean signatureDisponible;
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
                .identifiantFiscal(agence.getIdentifiantFiscal())
                .patente(agence.getPatente())
                .ice(agence.getIce())
                .numeroAgrement(agence.getNumeroAgrement())
                .dateAgrement(agence.getDateAgrement())
                .banque(agence.getBanque())
                .rib(agence.getRib())
                .logoDisponible(agence.getLogoCheminStockage() != null && !agence.getLogoCheminStockage().isBlank())
                .signatureDisponible(agence.getSignatureCheminStockage() != null
                        && !agence.getSignatureCheminStockage().isBlank())
                .statut(agence.getStatut())
                .build();
    }
}
