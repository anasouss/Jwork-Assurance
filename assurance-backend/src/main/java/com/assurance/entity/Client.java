package com.assurance.entity;

import com.assurance.enums.TypeClient;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "clients", indexes = {
        @Index(name = "idx_client_agence", columnList = "agence_id"),
        @Index(name = "idx_client_type", columnList = "type_client"),
        @Index(name = "idx_client_cin", columnList = "cin"),
        @Index(name = "idx_client_rc", columnList = "rc"),
        @Index(name = "idx_client_ice", columnList = "ice")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Client extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agence_id", nullable = false)
    private Agence agence;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "client_parent_id")
    private Client clientParent;

    @OneToMany(mappedBy = "clientParent")
    @Builder.Default
    private List<Client> sousClients = new ArrayList<>();

    @Enumerated(EnumType.STRING)
    @Column(name = "type_client", nullable = false, length = 30)
    private TypeClient typeClient;

    @Column(name = "code_client", length = 60)
    private String codeClient;

    @Column(length = 30)
    private String civilite;

    @Column(name = "prenom", length = 100)
    private String prenom;

    @Column(name = "nom", length = 100)
    private String nom;

    @Column(name = "raison_sociale", length = 180)
    private String raisonSociale;

    @Column(length = 120)
    private String cin;

    @Column(length = 120)
    private String rc;

    @Column(length = 120)
    private String ice;

    @Column(length = 120)
    private String numeroPermis;

    private LocalDate dateDelivrancePermis;

    private LocalDate dateValiditePermis;

    private LocalDate dateNaissance;

    @Column(length = 255)
    private String adresse;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ville_id")
    private Ville ville;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "categorie_client_id")
    private CategorieClient categorieClient;

    @Column(length = 60)
    private String telephone;

    @OneToMany(mappedBy = "client", orphanRemoval = true)
    @Builder.Default
    private List<ClientTelephone> telephones = new ArrayList<>();

    @Column(length = 150)
    private String email;

    @Column(name = "cin_validite")
    private LocalDate cinValidite;

    @Column(length = 120)
    private String nationalite;

    @Column(length = 120)
    private String passport;

    @Column(name = "carte_residence", length = 120)
    private String carteResidence;

    @Column(length = 120)
    private String iff;

    @Column(length = 120)
    private String patente;

    @Column(length = 120)
    private String cnss;

    @Column(length = 120)
    private String activite;

    @Builder.Default
    @Column(name = "conducteur_habituel", nullable = false)
    private Boolean conducteurHabituel = true;

    @Builder.Default
    @Column(name = "sahara", nullable = false)
    private Boolean sahara = false;

    @Column(name = "justificatif_sahara", length = 255)
    private String justificatifSahara;

    @Builder.Default
    @Column(nullable = false)
    private Boolean actif = true;

    public String getNomAffichage() {
        if (typeClient == TypeClient.PERSONNE_MORALE) {
            return raisonSociale;
        }
        return ((prenom == null ? "" : prenom) + " " + (nom == null ? "" : nom)).trim();
    }
}
