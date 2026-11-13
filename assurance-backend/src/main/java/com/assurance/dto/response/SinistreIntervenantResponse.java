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
    private boolean conventionne;
    private com.assurance.enums.TypePrestataireSinistre typePrestataire;
    private boolean toutesCompagnies;
    private java.util.List<SpecialitePrestataireResponse> specialites;
    private java.util.List<Accord> accords;

    public record Accord(Long compagnieId, String compagnie, boolean actif, boolean conventionne,
            java.time.LocalDate dateDebut, java.time.LocalDate dateFin) {
    }
}
