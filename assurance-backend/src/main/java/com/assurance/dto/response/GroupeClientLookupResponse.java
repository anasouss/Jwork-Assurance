package com.assurance.dto.response;

public record GroupeClientLookupResponse(Long id, String code, String libelle,
                                         String clientTeteNom, String clientTresorerieNom,
                                         int nombreMembres, Boolean actif) {
}
