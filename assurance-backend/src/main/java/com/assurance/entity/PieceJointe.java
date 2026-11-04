package com.assurance.entity;

import com.assurance.enums.DocumentOwner;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "pieces_jointes", indexes = {
        @Index(name = "idx_piece_jointe_contrat", columnList = "contrat_id"),
        @Index(name = "idx_piece_jointe_mouvement", columnList = "mouvement_contrat_id"),
        @Index(name = "idx_document_agence_client", columnList = "agence_id,client_id"),
        @Index(name = "idx_document_agence_vehicle", columnList = "agence_id,vehicule_id")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PieceJointe extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contrat_id")
    private Contrat contrat;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agence_id")
    private Agence agence;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "client_id")
    private Client client;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "vehicule_id")
    private Vehicule vehicule;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "previous_version_id")
    private PieceJointe previousVersion;

    @Enumerated(EnumType.STRING)
    @Column(name = "document_owner", length = 20)
    @Builder.Default
    private DocumentOwner documentOwner = DocumentOwner.CONTRAT;

    @Column(name = "expires_on")
    private LocalDate expiresOn;

    @Builder.Default
    @Column(nullable = false)
    private Boolean archived = false;

    @Column(name = "change_reason", length = 500)
    private String changeReason;

    @Column(name = "created_by", length = 180)
    private String createdBy;

    @Column(name = "archived_by", length = 180)
    private String archivedBy;

    @Column(name = "archived_at")
    private LocalDateTime archivedAt;

    @Column(name = "assigned_by", length = 180)
    private String assignedBy;

    @Column(name = "assigned_at")
    private LocalDateTime assignedAt;

    @Version
    @Column(name = "lock_version")
    private Long lockVersion;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "mouvement_contrat_id")
    private MouvementContrat mouvementContrat;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "type_piece_jointe_id")
    private TypePieceJointe typePieceJointe;

    @Column(name = "nom_fichier", nullable = false, length = 255)
    private String nomFichier;

    @Column(name = "content_type", length = 120)
    private String contentType;

    @Column(name = "chemin_stockage", nullable = false, length = 500)
    private String cheminStockage;

    @Column(name = "taille_octets")
    private Long tailleOctets;
}
