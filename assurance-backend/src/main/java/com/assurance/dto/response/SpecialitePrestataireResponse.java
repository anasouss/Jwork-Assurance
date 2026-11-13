package com.assurance.dto.response;

import com.assurance.enums.TypePrestataireSinistre;
import java.util.List;

public record SpecialitePrestataireResponse(Long id, String code, String libelle,
        TypePrestataireSinistre typePrestataire, boolean actif, List<Reference> garanties) {
    public record Reference(Long id, String libelle) {
    }
}
