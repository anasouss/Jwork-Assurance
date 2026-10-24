package com.assurance.entity;

import com.assurance.enums.TypeAssistance;
import com.assurance.enums.TypeClient;
import com.assurance.enums.TypeContrat;
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

@Entity
@Table(name = "types_piece_jointe", indexes = {
        @Index(name = "idx_type_piece_agence", columnList = "agence_id"),
        @Index(name = "idx_type_piece_branche", columnList = "branche_assurance_id"),
        @Index(name = "idx_type_piece_nature", columnList = "nature_piece_jointe_id"),
        @Index(name = "idx_type_piece_mouvement", columnList = "type_mouvement_id")
}, uniqueConstraints = {
        @UniqueConstraint(name = "uk_type_piece_agence_source", columnNames = {"agence_id", "source_systeme_id"})
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TypePieceJointe extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agence_id")
    private Agence agence;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_systeme_id")
    private TypePieceJointe sourceSysteme;

    // Retained as the historical display snapshot; the catalogue relation is authoritative.
    @Column(nullable = false, length = 160)
    private String libelle;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "nature_piece_jointe_id", nullable = false)
    private NaturePieceJointe naturePieceJointe;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "branche_assurance_id")
    private BrancheAssurance brancheAssurance;

    @Enumerated(EnumType.STRING)
    @Column(name = "type_assistance", length = 20)
    private TypeAssistance typeAssistance;

    @Enumerated(EnumType.STRING)
    @Column(name = "type_contrat", length = 30)
    private TypeContrat typeContrat;

    @Enumerated(EnumType.STRING)
    @Column(name = "type_client", length = 30)
    private TypeClient typeClient;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "type_mouvement_id")
    private TypeMouvementContrat typeMouvement;

    @Builder.Default
    @Column(nullable = false)
    private Boolean obligatoire = false;

    @Column(name = "ordre_affichage")
    private Integer ordreAffichage;

    @Builder.Default
    @Column(nullable = false)
    private Boolean actif = true;
}
