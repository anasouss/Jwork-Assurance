package com.assurance.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
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

import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "categories_client")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CategorieClient extends BaseEntity {

    @Column(nullable = false, unique = true, length = 80)
    private String code;

    @Column(nullable = false, length = 160)
    private String libelle;

    @Builder.Default
    @Column(nullable = false)
    private Boolean actif = true;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "categorie_client_usages",
            joinColumns = @JoinColumn(name = "categorie_client_id"),
            inverseJoinColumns = @JoinColumn(name = "usage_id")
    )
    @Builder.Default
    private Set<Usage> usages = new HashSet<>();

    @OneToMany(mappedBy = "categorieClient")
    @Builder.Default
    private Set<Client> clients = new HashSet<>();
}
