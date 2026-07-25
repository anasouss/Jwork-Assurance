package com.assurance.entity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
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
@Table(name = "produits_assistance", indexes = {
        @Index(name = "idx_produit_assistance_compagnie", columnList = "compagnie_assistance_id"),
        @Index(name = "idx_produit_assistance_categorie", columnList = "categorie_client_id")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProduitAssistance extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "compagnie_assistance_id", nullable = false)
    private CompagnieAssistance compagnieAssistance;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "categorie_client_id")
    private CategorieClient categorieClient;

    @Column(nullable = false, length = 160)
    private String libelle;

    @Column(length = 80)
    private String type;

    @Column(length = 2000)
    private String prestations;

    @ManyToMany
    @JoinTable(
            name = "produit_assistance_usages",
            joinColumns = @JoinColumn(name = "produit_assistance_id"),
            inverseJoinColumns = @JoinColumn(name = "usage_id")
    )
    @OrderBy("code ASC")
    @Builder.Default
    private Set<Usage> usages = new LinkedHashSet<>();

    @OneToMany(mappedBy = "produitAssistance", fetch = FetchType.LAZY, cascade = CascadeType.ALL)
    @OrderBy("dateDebut DESC, id DESC")
    @Builder.Default
    private List<TarifProduitAssistance> tarifs = new ArrayList<>();

    @Builder.Default
    @Column(nullable = false)
    private Boolean actif = true;
}
