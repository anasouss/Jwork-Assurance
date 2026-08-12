package com.assurance.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ConfigurationImportReleveBancaireRequest {

    @Min(1)
    private Integer ligneEntete = 1;

    @Size(max = 120)
    private String feuille;

    @Size(max = 5)
    private String separateur;

    @Size(max = 40)
    private String encodage = "UTF-8";

    @Size(max = 40)
    private String formatDate = "dd/MM/yyyy";

    @Size(max = 2)
    private String separateurDecimal = ",";

    @Valid
    private Colonnes colonnes = new Colonnes();

    private Boolean enregistrerProfil = false;

    @Size(max = 120)
    private String nomProfil;

    @Getter
    @Setter
    public static class Colonnes {
        private String dateOperation;
        private String dateValeur;
        private String libelle;
        private String reference;
        private String contrepartie;
        private String compteContrepartie;
        private String debit;
        private String credit;
        private String montant;
        private String sens;
        private String solde;
    }
}
