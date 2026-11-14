package com.assurance.dto.response;

public record ClientLookupResponse(Long id, String codeClient, String nomAffichage,
                                   String cin, String rc, String ice, String email,
                                   ClientResponse.GroupeView groupe) {
    public static ClientLookupResponse from(ClientResponse client) {
        return new ClientLookupResponse(client.getId(), client.getCodeClient(), client.getNomAffichage(),
                client.getCin(), client.getRc(), client.getIce(), client.getEmail(), client.getGroupe());
    }
}
