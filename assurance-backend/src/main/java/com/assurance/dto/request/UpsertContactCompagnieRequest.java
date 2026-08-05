package com.assurance.dto.request;

import com.assurance.enums.ServiceContactCompagnie;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpsertContactCompagnieRequest {

    @NotBlank(message = "Le nom est obligatoire")
    @Size(max = 100)
    private String nom;

    @Size(max = 100)
    private String prenom;

    @NotNull(message = "Le service est obligatoire")
    private ServiceContactCompagnie service;

    @Size(max = 150)
    private String fonction;

    @Email(message = "L'adresse e-mail n'est pas valide")
    @Size(max = 150)
    private String email;

    @Size(max = 50)
    private String telephoneMobile;

    @Size(max = 50)
    private String telephoneFixe;

    @Size(max = 30)
    private String posteTelephonique;

    private Boolean whatsapp;

    @Size(max = 50)
    private String fax;

    private Boolean principal;

    @Size(max = 1000)
    private String notes;
}
