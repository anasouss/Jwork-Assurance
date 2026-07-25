package com.assurance.dto.request;

import jakarta.validation.constraints.NotBlank;
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
    private Boolean actif;
}
