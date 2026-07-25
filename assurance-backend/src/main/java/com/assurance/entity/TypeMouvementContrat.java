package com.assurance.entity;

import com.assurance.enums.CategorieMouvementContrat;
import com.assurance.enums.TypeContrat;
import com.assurance.enums.TypeImpactMouvement;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
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
@Table(name = "types_mouvement_contrat", indexes = {
        @Index(name = "idx_type_mouvement_code", columnList = "code"),
        @Index(name = "idx_type_mouvement_categorie", columnList = "categorie")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TypeMouvementContrat extends BaseEntity {

    @Column(nullable = false, unique = true, length = 40)
    private String code;

    @Column(nullable = false, length = 160)
    private String libelle;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private CategorieMouvementContrat categorie;

    @Enumerated(EnumType.STRING)
    @Column(name = "type_impact", nullable = false, length = 40)
    @Builder.Default
    private TypeImpactMouvement typeImpact = TypeImpactMouvement.NORMAL;

    @Builder.Default
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "type_mouvement_types_contrat", joinColumns = @JoinColumn(name = "type_mouvement_id"))
    @Enumerated(EnumType.STRING)
    @Column(name = "type_contrat", nullable = false, length = 30)
    private Set<TypeContrat> typesContratAutorises = new LinkedHashSet<>();

    @Builder.Default
    @Column(name = "modifie_garanties", nullable = false)
    private Boolean modifieGaranties = false;

    @Builder.Default
    @Column(name = "garanties_editables", nullable = false)
    private Boolean garantiesEditables = false;

    @Builder.Default
    @Column(name = "modifie_vehicule", nullable = false)
    private Boolean modifieVehicule = false;

    @Builder.Default
    @Column(name = "modifie_remorque", nullable = false)
    private Boolean modifieRemorque = false;

    @Builder.Default
    @Column(name = "cnpac_seul", nullable = false)
    private Boolean cnpacSeul = false;

    @Builder.Default
    @Column(name = "genere_quittance", nullable = false)
    private Boolean genereQuittance = true;

    @Builder.Default
    @Column(name = "autorise_assistance", nullable = false)
    private Boolean autoriseAssistance = false;

    @Builder.Default
    @Column(name = "autorise_carte_verte", nullable = false)
    private Boolean autoriseCarteVerte = false;

    @Builder.Default
    @Column(name = "consomme_attestation", nullable = false)
    private Boolean consommeAttestation = false;

    @Builder.Default
    @Column(name = "cloture_contrat", nullable = false)
    private Boolean clotureContrat = false;

    @Builder.Default
    @Column(name = "renouvelle_contrat", nullable = false)
    private Boolean renouvelleContrat = false;

    @Column(name = "ordre_affichage")
    private Integer ordreAffichage;

    @Builder.Default
    @Column(nullable = false)
    private Boolean actif = true;
}
