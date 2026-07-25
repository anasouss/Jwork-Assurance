package com.assurance.entity;

import com.assurance.enums.ModeTarificationGarantie;
import com.assurance.enums.SourceValeurGarantie;
import com.assurance.enums.TypeGarantie;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.LinkedHashSet;
import java.util.Set;

@Entity
@Table(name = "garanties")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Garantie extends BaseEntity {

    @Column(nullable = false, unique = true, length = 80)
    private String code;

    @Column(nullable = false, length = 150)
    private String libelle;

    @Column(length = 500)
    private String description;

    @Column(length = 80)
    private String branche;

    @Enumerated(EnumType.STRING)
    @Column(name = "type_garantie", nullable = false, length = 30)
    @Builder.Default
    private TypeGarantie typeGarantie = TypeGarantie.VEHICULE;

    @Builder.Default
    @Column(nullable = false)
    private Boolean obligatoire = false;

    @Builder.Default
    @Column(name = "responsabilite_civile", nullable = false)
    private Boolean responsabiliteCivile = false;

    @Builder.Default
    @Column(name = "defense_recours", nullable = false)
    private Boolean defenseRecours = false;

    @Column(name = "remplace_par_id", length = 36)
    private String remplaceParId;

    @Builder.Default
    @Column(name = "requiert_valeur_venale", nullable = false)
    private Boolean requiertValeurVenale = false;

    @Builder.Default
    @Column(name = "requiert_valeur_neuf", nullable = false)
    private Boolean requiertValeurNeuf = false;

    @Builder.Default
    @Column(name = "requiert_valeur_glace", nullable = false)
    private Boolean requiertValeurGlace = false;

    @Builder.Default
    @Column(name = "avec_franchise", nullable = false)
    private Boolean avecFranchise = false;

    @Builder.Default
    @Column(name = "avec_capital", nullable = false)
    private Boolean avecCapital = false;

    @Builder.Default
    @Column(name = "tarification_multiple", nullable = false)
    private Boolean tarificationMultiple = false;

    @Builder.Default
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "garantie_modes_tarification", joinColumns = @JoinColumn(name = "garantie_id"))
    @Enumerated(EnumType.STRING)
    @Column(name = "mode_tarification", nullable = false, length = 40)
    private Set<ModeTarificationGarantie> modesAutorises = new LinkedHashSet<>();

    @Enumerated(EnumType.STRING)
    @Column(name = "mode_par_defaut", length = 40)
    private ModeTarificationGarantie modeParDefaut;

    @Builder.Default
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "garantie_sources_valeur", joinColumns = @JoinColumn(name = "garantie_id"))
    @Enumerated(EnumType.STRING)
    @Column(name = "source_valeur", nullable = false, length = 40)
    private Set<SourceValeurGarantie> sourcesValeurAutorisees = new LinkedHashSet<>();

    @Enumerated(EnumType.STRING)
    @Column(name = "source_valeur_par_defaut", length = 40)
    private SourceValeurGarantie sourceValeurParDefaut;

    @Builder.Default
    @Column(name = "saisie_manuelle_autorisee", nullable = false)
    private Boolean saisieManuelleAutorisee = false;

    @Builder.Default
    @Column(nullable = false)
    private Boolean verrouillee = false;

    @Column(name = "ordre_affichage")
    private Integer ordreAffichage;

    @Builder.Default
    @Column(nullable = false)
    private Boolean actif = true;
}
