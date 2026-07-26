package com.assurance.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

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

    @ManyToMany
    @JoinTable(
            name = "groupe_usage_attestation_compagnies",
            joinColumns = @JoinColumn(name = "groupe_usage_attestation_id"),
            inverseJoinColumns = @JoinColumn(name = "compagnie_assurance_id")
    )
    @Builder.Default
    private Set<CompagnieAssurance> compagniesRestreintes = new LinkedHashSet<>();

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
