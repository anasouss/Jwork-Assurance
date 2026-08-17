package com.assurance.entity;

import com.assurance.enums.TypeJustificationConditionPaiement;
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

import java.time.LocalDate;

@Entity
@Table(name = "conditions_paiement_clients", indexes = {
        @Index(
                name = "uk_condition_paiement_agence_client_debut",
                columnList = "agence_id,client_payeur_id,date_debut",
                unique = true
        ),
        @Index(
                name = "uk_condition_paiement_agence_groupe_debut",
                columnList = "agence_id,groupe_payeur_id,date_debut",
                unique = true
        )
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConditionPaiementClient extends AuditedEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agence_id", nullable = false)
    private Agence agence;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "client_payeur_id")
    private Client clientPayeur;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "groupe_payeur_id")
    private GroupeClient groupePayeur;

    @Column(name = "delai_jours", nullable = false)
    private Integer delaiJours;

    @Enumerated(EnumType.STRING)
    @Column(name = "type_justification", nullable = false, length = 40)
    private TypeJustificationConditionPaiement typeJustification;

    @Column(name = "date_debut", nullable = false)
    private LocalDate dateDebut;

    @Column(name = "date_fin")
    private LocalDate dateFin;

    @Column(name = "nom_fichier", length = 255)
    private String nomFichier;

    @Column(name = "content_type", length = 120)
    private String contentType;

    @Column(name = "chemin_stockage", length = 500)
    private String cheminStockage;

    @Column(name = "taille_octets")
    private Long tailleOctets;

    @Column(length = 500)
    private String commentaire;
}
