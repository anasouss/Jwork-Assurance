package com.assurance.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "client_portal_claim_updates", indexes = {
        @Index(name = "idx_portal_update_access", columnList = "access_id,published,created_at")
})
@Getter
@Setter
@NoArgsConstructor
public class ClientPortalClaimUpdate extends AuditedEntity {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "access_id", nullable = false)
    private ClientPortalAccess access;

    @Column(nullable = false, length = 180)
    private String titre;

    @Column(nullable = false, length = 2000)
    private String message;

    @Column(nullable = false)
    private boolean published = true;
}
