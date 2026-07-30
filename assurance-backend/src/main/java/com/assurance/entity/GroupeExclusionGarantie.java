package com.assurance.entity;

import com.assurance.enums.TypeGarantie;
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
@Table(name = "groupes_exclusion_garanties")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GroupeExclusionGarantie extends BaseEntity {

    @Column(nullable = false, unique = true, length = 80)
    private String code;

    @Column(nullable = false, length = 150)
    private String libelle;

    @Enumerated(EnumType.STRING)
    @Column(name = "type_garantie", nullable = false, length = 30)
    @Builder.Default
    private TypeGarantie typeGarantie = TypeGarantie.VEHICULE;

    @Builder.Default
    @Column(nullable = false)
    private Boolean actif = true;
}
