package com.assurance.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "client_portal_accounts", uniqueConstraints = {
        @UniqueConstraint(name = "uk_portal_agency_login", columnNames = {"agence_id", "identifiant"}),
        @UniqueConstraint(name = "uk_portal_agency_client", columnNames = {"agence_id", "client_id"})
})
@Getter
@Setter
@NoArgsConstructor
public class ClientPortalAccount extends AuditedEntity {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agence_id", nullable = false)
    private Agence agence;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "client_id", nullable = false)
    private Client client;

    @Column(nullable = false, length = 120)
    private String identifiant;

    @Column(name = "password_hash", nullable = false, length = 100)
    private String passwordHash;

    @Column(nullable = false)
    private boolean actif = true;

    @Column(name = "password_change_required", nullable = false)
    private boolean passwordChangeRequired = true;

    @Column(name = "failed_attempts", nullable = false)
    private int failedAttempts;

    @Column(name = "locked_until")
    private LocalDateTime lockedUntil;

    @Column(name = "last_login_at")
    private LocalDateTime lastLoginAt;

    @Version
    private long version;
}
