package com.assurance.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "client_portal_access", uniqueConstraints = {
        @UniqueConstraint(name = "uk_portal_access_contract", columnNames = {"account_id", "contrat_id"}),
        @UniqueConstraint(name = "uk_portal_access_claim", columnNames = {"account_id", "sinistre_id"})
})
@Getter
@Setter
@NoArgsConstructor
public class ClientPortalAccess extends AuditedEntity {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "account_id", nullable = false)
    private ClientPortalAccount account;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contrat_id")
    private Contrat contrat;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sinistre_id")
    private Sinistre sinistre;

    @Column(nullable = false)
    private boolean actif = true;
}
