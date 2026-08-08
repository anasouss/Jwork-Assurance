package com.assurance.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class UpsertCompagnieAssuranceRequest {
    @NotBlank
    private String code;

    @NotBlank
    private String nom;

    private String adresse;
    private String ville;
    private String email;
    private String telephone;
    private String rc;
    private String ice;
    private String prefixeAttestation;
    private String prefixeCarteVerte;

    @Pattern(
            regexp = "^\\s*(?:[A-Za-z0-9]{1,10})?\\s*$",
            message = "Le préfixe dossier doit contenir entre 1 et 10 lettres ou chiffres"
    )
    private String prefixeDossier;

    private Integer ordreAffichage;
    private Boolean actif;
}
