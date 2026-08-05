package com.assurance.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;

@Entity
@Table(name = "sinistre_couvertures",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_sinistre_couverture",
                columnNames = "sinistre_id"
        ))
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SinistreCouverture extends BaseEntity {

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sinistre_id", nullable = false)
    private Sinistre sinistre;

    @Column(name = "numero_police", length = 80)
    private String numeroPolice;

    @Column(name = "numero_dossier", length = 80)
    private String numeroDossier;

    @Column(name = "compagnie_code", length = 60)
    private String compagnieCode;

    @Column(name = "compagnie_libelle", length = 180)
    private String compagnieLibelle;

    @Column(name = "client_code", length = 60)
    private String clientCode;

    @Column(name = "assure", length = 200)
    private String assure;

    @Column(name = "date_effet")
    private LocalDate dateEffet;

    @Column(name = "date_echeance")
    private LocalDate dateEcheance;

    @Column(name = "immatriculation", length = 80)
    private String immatriculation;

    @Column(name = "numero_attestation", length = 80)
    private String numeroAttestation;

    @Column(name = "marque", length = 100)
    private String marque;

    @Column(name = "usage_code", length = 40)
    private String usageCode;

    @Column(name = "usage_libelle", length = 160)
    private String usageLibelle;
}
