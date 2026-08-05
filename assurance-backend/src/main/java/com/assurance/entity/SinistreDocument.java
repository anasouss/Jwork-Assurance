package com.assurance.entity;

import com.assurance.enums.StatutDocumentSinistre;
import com.assurance.enums.TypeDocumentSinistre;
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

import java.time.LocalDateTime;

@Entity
@Table(name = "sinistre_documents",
        indexes = @Index(name = "idx_sinistre_document", columnList = "sinistre_id,type"))
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SinistreDocument extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sinistre_id", nullable = false)
    private Sinistre sinistre;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "depose_par_id", nullable = false)
    private Utilisateur deposePar;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "valide_par_id")
    private Utilisateur validePar;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private TypeDocumentSinistre type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private StatutDocumentSinistre statut;

    @Column(name = "nom_fichier", nullable = false, length = 255)
    private String nomFichier;

    @Column(name = "content_type", length = 120)
    private String contentType;

    @Column(name = "chemin_stockage", nullable = false, length = 500)
    private String cheminStockage;

    @Column(name = "taille_octets", nullable = false)
    private long tailleOctets;

    @Column(name = "date_validation")
    private LocalDateTime dateValidation;

    @Column(length = 500)
    private String commentaire;
}
