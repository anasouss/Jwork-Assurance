package com.assurance.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpsertUtilisateurRequest {
    private Long agenceId;

    @NotNull
    private Long roleId;

    @Email
    @NotBlank
    private String email;

    @Size(min = 8, message = "Le mot de passe doit contenir au moins 8 caracteres")
    private String password;

    @NotBlank
    private String prenom;

    @NotBlank
    private String nom;

    private String telephone;
    private Boolean actif = true;
}
