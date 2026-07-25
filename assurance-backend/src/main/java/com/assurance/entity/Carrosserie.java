package com.assurance.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "carrosseries")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Carrosserie extends BaseEntity {

    @Column(nullable = false, unique = true, length = 120)
    private String libelle;

    @Builder.Default
    @Column(nullable = false)
    private Boolean actif = true;

    @ManyToMany(mappedBy = "carrosseries", fetch = FetchType.LAZY)
    @Builder.Default
    private Set<Usage> usages = new HashSet<>();
}
