package com.assurance.entity;

import jakarta.persistence.Column;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "quittances", indexes = {
        @Index(name = "idx_quittance_contrat", columnList = "contrat_id"),
        @Index(name = "idx_quittance_numero", columnList = "numero_quittance")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Quittance extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contrat_id", nullable = false)
    private Contrat contrat;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "mouvement_contrat_id")
    private MouvementContrat mouvementContrat;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "element_facturable_id")
    private ElementFacturable elementFacturable;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "compagnie_assurance_id")
    private CompagnieAssurance compagnieAssurance;

    @Column(name = "numero_quittance", nullable = false, length = 80)
    private String numeroQuittance;

    @Column(length = 60)
    private String type;

    @Column(length = 80)
    private String categorie;

    private Integer periode;

    private LocalDate dateDebut;

    private LocalDate dateFin;

    @Column(name = "prime_nette", precision = 14, scale = 2)
    private BigDecimal primeNette;

    @Column(name = "prime_totale", precision = 14, scale = 2)
    private BigDecimal primeTotale;

    @Column(precision = 14, scale = 2)
    private BigDecimal taxe;

    @Column(name = "taxe_parafiscale", precision = 14, scale = 2)
    private BigDecimal taxeParafiscale;

    @Column(precision = 14, scale = 2)
    private BigDecimal accessoire;

    @Column(precision = 14, scale = 2)
    private BigDecimal cnpac;

    @Builder.Default
    @Column(nullable = false)
    private Boolean payee = false;

    @Builder.Default
    @Column(nullable = false)
    private Boolean globale = false;

    @Builder.Default
    @Column(nullable = false)
    private Boolean alternative = false;

    @Column(name = "numero_alternatif", length = 80)
    private String numeroAlternatif;

    @Builder.Default
    @OneToMany(mappedBy = "quittance", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<LigneQuittance> lignes = new ArrayList<>();
}
