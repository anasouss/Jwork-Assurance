package com.assurance.dto.request;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.assurance.enums.RelationGroupeClient;
import com.assurance.enums.TypeClient;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;
import java.util.List;

@Data
public class CreateClientRequest {
    @JsonIgnore
    private Long agenceId;

    @NotNull
    private TypeClient typeClient;

    private Long clientParentId;
    private Long groupeClientId;
    private RelationGroupeClient relationGroupe;
    private Long villeId;
    private Long categorieClientId;
    private String codeClient;
    private String civilite;
    private String prenom;
    private String nom;
    private String raisonSociale;
    private String cin;
    private String rc;
    private String ice;
    private String numeroPermis;
    private LocalDate dateDelivrancePermis;
    private LocalDate dateValiditePermis;
    private LocalDate dateNaissance;
    private String adresse;
    private String telephone;
    private String email;
    private LocalDate cinValidite;
    private String nationalite;
    private String passport;
    private String carteResidence;
    private String iff;
    private String patente;
    private String cnss;
    private Boolean conducteurHabituel;
    private Boolean sahara;
    private String justificatifSahara;
    private List<TelephoneInput> telephones;

    @Data
    public static class TelephoneInput {
        @NotBlank
        private String numero;
        private Boolean whatsapp;
        private Boolean principal;
    }
}
