package com.assurance.entity;

import com.assurance.enums.ChampMoteurSousClasse;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "sous_classes")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SousClasse extends BaseEntity {

    @Column(nullable = false, unique = true, length = 80)
    private String code;

    @Column(nullable = false, length = 120)
    private String libelle;

    @Builder.Default
    @Column(nullable = false)
    private Boolean actif = true;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(
            name = "champ_moteur",
            nullable = false,
            length = 30,
            columnDefinition = "varchar(30) default 'PUISSANCE_FISCALE'"
    )
    private ChampMoteurSousClasse champMoteur = ChampMoteurSousClasse.PUISSANCE_FISCALE;

    @Builder.Default
    @Column(name = "conducteur_permis_requis", nullable = false, columnDefinition = "boolean default false")
    private Boolean conducteurPermisRequis = false;

    @Builder.Default
    @Column(name = "assistance_autorisee", nullable = false, columnDefinition = "boolean default false")
    private Boolean assistanceAutorisee = false;
}
