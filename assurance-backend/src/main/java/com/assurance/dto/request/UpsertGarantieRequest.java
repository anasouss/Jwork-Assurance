package com.assurance.dto.request;

import com.assurance.enums.ModeTarificationGarantie;
import com.assurance.enums.SourceValeurGarantie;
import com.assurance.enums.TypeGarantie;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.Set;

@Data
public class UpsertGarantieRequest {
    @NotBlank
    private String code;

    @NotBlank
    private String libelle;

    private String description;
    private String branche;
    private Long groupeExclusionId;
    private TypeGarantie typeGarantie;
    private Boolean obligatoire;
    private Boolean responsabiliteCivile;
    private Boolean defenseRecours;
    private Boolean requiertValeurVenale;
    private Boolean requiertValeurNeuf;
    private Boolean requiertValeurGlace;
    private Boolean avecFranchise;
    private Boolean avecFranchiseMinimale;
    private Boolean avecCapital;
    private Boolean tarificationMultiple;
    private Set<ModeTarificationGarantie> modesTarificationMultiple;
    private Set<ModeTarificationGarantie> modesAutorises;
    private ModeTarificationGarantie modeParDefaut;
    private Set<SourceValeurGarantie> sourcesValeurAutorisees;
    private SourceValeurGarantie sourceValeurParDefaut;
    private Boolean saisieManuelleAutorisee;
    private Boolean verrouillee;
    private Integer ordreAffichage;
    private Boolean actif;
}
