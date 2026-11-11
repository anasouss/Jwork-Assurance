package com.assurance.entity;

import com.assurance.enums.Fractionnement;
import com.assurance.enums.TypeEcheanceConvention;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.util.LinkedHashSet;
import java.util.Set;

@Entity
@Table(name = "conventions", indexes = {
        @Index(name = "idx_convention_agence", columnList = "agence_id"),
        @Index(name = "idx_convention_compagnie", columnList = "compagnie_assurance_id"),
        @Index(name = "idx_convention_actif", columnList = "actif")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Convention extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agence_id", nullable = false)
    private Agence agence;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "compagnie_assurance_id", nullable = false)
    private CompagnieAssurance compagnieAssurance;

    @Column(nullable = false, length = 80)
    private String code;

    @Column(nullable = false, length = 150)
    private String intitule;

    @Column(length = 500)
    private String description;

    @Column(name = "organisme_conventionne", length = 180)
    private String organismeConventionne;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "categorie_client_id")
    private CategorieClient categorieClient;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "grille_tarifaire_id")
    private GrilleTarifaire grilleTarifaire;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "convention_usages",
            joinColumns = @JoinColumn(name = "convention_id"),
            inverseJoinColumns = @JoinColumn(name = "usage_id")
    )
    @Builder.Default
    private Set<Usage> usages = new LinkedHashSet<>();

    @Column(name = "date_effet")
    private LocalDate dateEffet;

    @Column(name = "date_echeance")
    private LocalDate dateEcheance;

    @Enumerated(EnumType.STRING)
    @Column(name = "type_echeance", length = 30)
    @Builder.Default
    private TypeEcheanceConvention typeEcheance = TypeEcheanceConvention.DATE_A_DATE;

    @Column(length = 5)
    private String echeance;

    @Enumerated(EnumType.STRING)
    @Column(length = 30)
    private Fractionnement fractionnement;

    @Builder.Default
    @Column(nullable = false)
    private Boolean actif = true;
}
