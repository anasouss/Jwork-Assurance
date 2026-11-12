package com.assurance.dto.response;

import com.assurance.enums.RoleClientContrat;

import java.time.LocalDate;
import java.util.List;

public record SinistreContratLookupResponse(
        Long id,
        String numeroPolice,
        String numeroDossier,
        String brancheAssuranceCode,
        String brancheAssuranceLibelle,
        String compagnieCode,
        String compagnieLibelle,
        LocalDate dateEffet,
        LocalDate dateEcheance,
        List<ClientRole> clients
) {
    public record ClientRole(RoleClientContrat role, String nomAffichage) {
    }
}
