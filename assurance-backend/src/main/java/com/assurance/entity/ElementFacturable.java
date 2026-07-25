package com.assurance.entity;

import com.assurance.enums.NatureElementFacturable;
import com.assurance.enums.StatutElementFacturable;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "elements_facturables", indexes = {
        @Index(name = "idx_element_facturable_agence", columnList = "agence_id"),
        @Index(name = "idx_element_facturable_contrat", columnList = "contrat_id"),
        @Index(name = "idx_element_facturable_mouvement", columnList = "mouvement_contrat_id"),
        @Index(name = "idx_element_facturable_statut", columnList = "statut")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ElementFacturable extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agence_id", nullable = false)
    private Agence agence;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contrat_id", nullable = false)
    private Contrat contrat;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "mouvement_contrat_id")
    private MouvementContrat mouvementContrat;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "compagnie_assurance_id")
    private CompagnieAssurance compagnieAssurance;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private NatureElementFacturable nature;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    @Builder.Default
    private StatutElementFacturable statut = StatutElementFacturable.BROUILLON;

    @Column(name = "reference_source", length = 120)
    private String referenceSource;

    @Column(length = 160)
    private String libelle;

    private LocalDate dateDebut;

    private LocalDate dateFin;

    @Column(name = "prime_nette", precision = 14, scale = 2)
    private BigDecimal primeNette;

    @Column(precision = 14, scale = 2)
    private BigDecimal taxe;

    @Column(name = "taxe_parafiscale", precision = 14, scale = 2)
    private BigDecimal taxeParafiscale;

    @Column(precision = 14, scale = 2)
    private BigDecimal accessoire;

    @Column(precision = 14, scale = 2)
    private BigDecimal cnpac;

    @Column(name = "prime_totale", precision = 14, scale = 2)
    private BigDecimal primeTotale;

    @Builder.Default
    @Column(nullable = false)
    private Boolean actif = true;
}
