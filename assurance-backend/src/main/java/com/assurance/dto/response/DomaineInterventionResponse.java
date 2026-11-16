package com.assurance.dto.response;

import com.assurance.enums.TypePrestataireSinistre;
import java.util.Set;

public record DomaineInterventionResponse(Long id, String code, String libelle, boolean actif,
        Long brancheId, String branche, Set<TypePrestataireSinistre> operateurs, String brancheCode) {
}
