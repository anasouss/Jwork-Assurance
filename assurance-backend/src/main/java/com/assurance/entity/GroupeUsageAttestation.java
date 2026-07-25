package com.assurance.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "groupes_usage_attestation")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GroupeUsageAttestation extends BaseEntity {

    @Column(nullable = false, unique = true, length = 20)
    private String code;

    @Column(nullable = false, length = 120)
    private String libelle;

    @Column(length = 20)
    private String couleur;

    @Column(name = "restriction_compagnie", length = 160)
    private String restrictionCompagnie;

    @Builder.Default
    @Column(name = "visible_stock", nullable = false)
    private Boolean visibleStock = true;

    @Builder.Default
    @Column(nullable = false)
    private Boolean actif = true;

    @OneToMany(mappedBy = "groupeUsageAttestation")
    @Builder.Default
    private List<Usage> usages = new ArrayList<>();
}
