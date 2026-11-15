package com.assurance.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "client_portal_documents", indexes = {
        @Index(name = "idx_portal_document_access", columnList = "access_id,published")
})
@Getter
@Setter
@NoArgsConstructor
public class ClientPortalDocument extends AuditedEntity {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "access_id", nullable = false)
    private ClientPortalAccess access;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "piece_jointe_id")
    private PieceJointe pieceJointe;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sinistre_document_id")
    private SinistreDocument sinistreDocument;

    @Column(nullable = false, length = 180)
    private String titre;

    @Column(nullable = false)
    private boolean published = true;
}
