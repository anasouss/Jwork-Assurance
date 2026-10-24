package com.assurance.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
@Table(name = "natures_piece_jointe", indexes = {
        @Index(name = "idx_nature_piece_agence", columnList = "agence_id")
}, uniqueConstraints = {
        @UniqueConstraint(name = "uk_nature_piece_agence_cle", columnNames = {"agence_id", "cle_normalisee"})
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NaturePieceJointe extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agence_id")
    private Agence agence;

    @Column(name = "cle_normalisee", nullable = false, length = 180)
    private String cleNormalisee;

    @Column(nullable = false, length = 160)
    private String libelle;

    @Builder.Default
    @Column(nullable = false)
    private Boolean actif = true;
}
