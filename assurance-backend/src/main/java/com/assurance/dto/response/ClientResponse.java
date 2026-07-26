package com.assurance.dto.response;

import com.assurance.enums.TypeClient;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;
import java.util.List;

@Data
@Builder
public class ClientResponse {
    private Long id;
    private Long agenceId;
    private Long clientParentId;
    private TypeClient typeClient;
    private String codeClient;
    private String nomAffichage;
    private String civilite;
    private String prenom;
    private String nom;
    private String raisonSociale;
    private String cin;
    private String rc;
    private String ice;
    private String numeroPermis;
    private LocalDate cinValidite;
    private LocalDate dateDelivrancePermis;
    private LocalDate dateValiditePermis;
    private LocalDate dateNaissance;
    private String adresse;
    private Long villeId;
    private String ville;
    private Boolean villeSaharienne;
    private Long categorieClientId;
    private String categorieClientCode;
    private String categorieClientLibelle;
    private String telephone;
    private String email;
    private String nationalite;
    private String passport;
    private String carteResidence;
    private String iff;
    private String patente;
    private String cnss;
    private Boolean conducteurHabituel;
    private Boolean sahara;
    private String justificatifSahara;
    private Boolean actif;
    private List<TelephoneView> telephones;

    @Data
    @Builder
    public static class TelephoneView {
        private Long id;
        private String numero;
        private Boolean whatsapp;
        private Boolean principal;
    }
}
