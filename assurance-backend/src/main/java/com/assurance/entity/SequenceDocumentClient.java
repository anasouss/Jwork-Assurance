package com.assurance.entity;

import com.assurance.enums.TypeDocumentClient;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
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
@Table(name = "sequences_documents_clients",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_sequence_document_client",
                columnNames = {"agence_id", "type_document", "annee"}
        ))
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SequenceDocumentClient extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agence_id", nullable = false)
    private Agence agence;

    @Enumerated(EnumType.STRING)
    @Column(name = "type_document", nullable = false, length = 20)
    private TypeDocumentClient typeDocument;

    @Column(nullable = false)
    private Integer annee;

    @Column(name = "prochaine_valeur", nullable = false)
    private Long prochaineValeur;
}
