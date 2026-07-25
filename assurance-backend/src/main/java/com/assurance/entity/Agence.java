package com.assurance.entity;

import com.assurance.enums.StatutAgence;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "agences", indexes = {
        @Index(name = "idx_agence_statut", columnList = "statut")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Agence extends BaseEntity {

    @Column(nullable = false, unique = true, length = 50)
    private String code;

    @Column(nullable = false, length = 150)
    private String nom;

    @Column(length = 255)
    private String adresse;

    @Column(length = 100)
    private String ville;

    @Column(length = 50)
    private String telephone;

    @Column(length = 50)
    private String fax;

    @Column(length = 150)
    private String email;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    @Builder.Default
    private StatutAgence statut = StatutAgence.ACTIVE;
}
