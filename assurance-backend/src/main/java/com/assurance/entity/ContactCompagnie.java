package com.assurance.entity;

import com.assurance.enums.ServiceContactCompagnie;
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

@Entity
@Table(name = "contacts_compagnie", indexes = {
        @Index(name = "idx_contact_compagnie_agence", columnList = "agence_id"),
        @Index(name = "idx_contact_compagnie_compagnie", columnList = "compagnie_assurance_id"),
        @Index(name = "idx_contact_compagnie_recherche", columnList = "agence_id,compagnie_assurance_id,service,actif")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ContactCompagnie extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "agence_id", nullable = false)
    private Agence agence;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "compagnie_assurance_id", nullable = false)
    private CompagnieAssurance compagnieAssurance;

    @Column(nullable = false, length = 100)
    private String nom;

    @Column(length = 100)
    private String prenom;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private ServiceContactCompagnie service;

    @Column(length = 150)
    private String fonction;

    @Column(length = 150)
    private String email;

    @Column(name = "telephone_mobile", length = 50)
    private String telephoneMobile;

    @Column(name = "telephone_fixe", length = 50)
    private String telephoneFixe;

    @Column(name = "poste_telephonique", length = 30)
    private String posteTelephonique;

    @Builder.Default
    @Column(nullable = false)
    private Boolean whatsapp = false;

    @Column(length = 50)
    private String fax;

    @Builder.Default
    @Column(nullable = false)
    private Boolean principal = false;

    @Column(length = 1000)
    private String notes;

    @Builder.Default
    @Column(nullable = false)
    private Boolean actif = true;
}
