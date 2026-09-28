package com.assurance.entity;

import com.assurance.enums.NatureSinistre;
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

@Entity
@Table(name = "exigences_documents_sinistre", indexes = @Index(
        name = "idx_exigence_document_sinistre",
        columnList = "agence_id,nature,actif,ordre"
))
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExigenceDocumentSinistre extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agence_id")
    private Agence agence;

    @Enumerated(EnumType.STRING)
    @Column(length = 40)
    private NatureSinistre nature;

    @Enumerated(EnumType.STRING)
    @Column(name = "type_document", nullable = false, length = 40)
    private TypeDocumentSinistre typeDocument;

    @Column(nullable = false, length = 180)
    private String libelle;

    @Builder.Default
    @Column(nullable = false)
    private boolean obligatoire = true;

    @Builder.Default
    @Column(nullable = false)
    private boolean actif = true;

    @Builder.Default
    @Column(nullable = false)
    private int ordre = 0;
}
