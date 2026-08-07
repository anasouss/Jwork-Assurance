package com.assurance.entity;

import com.assurance.enums.TypeCompteTresorerie;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

@Entity
@Table(name = "comptes_tresorerie",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_compte_tresorerie_agence_code",
                columnNames = {"agence_id", "code"}
        ),
        indexes = @Index(name = "idx_compte_tresorerie_agence_type", columnList = "agence_id,type_compte"))
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CompteTresorerie extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agence_id", nullable = false)
    private Agence agence;

    @Column(nullable = false, length = 50)
    private String code;

    @Column(nullable = false, length = 160)
    private String libelle;

    @Enumerated(EnumType.STRING)
    @Column(name = "type_compte", nullable = false, length = 20)
    private TypeCompteTresorerie typeCompte;

    @Column(name = "nom_banque", length = 160)
    private String nomBanque;

    @Column(length = 120)
    private String rib;

    @Column(nullable = false, length = 3)
    @Builder.Default
    private String devise = "MAD";

    @Column(name = "solde_initial", nullable = false, precision = 16, scale = 2)
    @Builder.Default
    private BigDecimal soldeInitial = BigDecimal.ZERO;

    @Column(nullable = false)
    @Builder.Default
    private Boolean actif = true;
}
