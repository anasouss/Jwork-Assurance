package com.assurance.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
@Table(name = "pieces_jointes", indexes = {
        @Index(name = "idx_piece_jointe_contrat", columnList = "contrat_id"),
        @Index(name = "idx_piece_jointe_mouvement", columnList = "mouvement_contrat_id")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PieceJointe extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contrat_id", nullable = false)
    private Contrat contrat;

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
