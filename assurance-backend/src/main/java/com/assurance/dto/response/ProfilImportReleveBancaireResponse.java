package com.assurance.dto.response;

import com.assurance.dto.request.ConfigurationImportReleveBancaireRequest;
import com.assurance.enums.FormatReleveBancaire;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class ProfilImportReleveBancaireResponse {
    private Long id;
    private Long compteTresorerieId;
    private String nom;
    private FormatReleveBancaire format;
    private ConfigurationImportReleveBancaireRequest configuration;
}
