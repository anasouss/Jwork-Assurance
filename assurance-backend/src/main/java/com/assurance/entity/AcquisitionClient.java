package com.assurance.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
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
@Table(name = "acquisitions_clients", uniqueConstraints = {
        @UniqueConstraint(name = "uk_acquisition_client", columnNames = "client_id")
}, indexes = {
        @Index(name = "idx_acquisition_agence_origine", columnList = "agence_id,origine_commerciale_id"),
        @Index(name = "idx_acquisition_collaborateur", columnList = "recommande_par_utilisateur_id"),
        @Index(name = "idx_acquisition_client_recommandant", columnList = "recommande_par_client_id")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AcquisitionClient extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agence_id", nullable = false)
    private Agence agence;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "client_id", nullable = false)
    private Client client;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "origine_commerciale_id", nullable = false)
    private OrigineCommerciale origineCommerciale;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recommande_par_utilisateur_id")
    private Utilisateur recommandeParUtilisateur;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recommande_par_client_id")
    private Client recommandeParClient;

    @Column(name = "date_acquisition", nullable = false)
    private LocalDate dateAcquisition;

    @Column(length = 1000)
    private String notes;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "saisi_par_id")
    private Utilisateur saisiPar;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "modifie_par_id")
    private Utilisateur modifiePar;
}
