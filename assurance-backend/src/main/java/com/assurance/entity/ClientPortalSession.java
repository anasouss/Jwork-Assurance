package com.assurance.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "client_portal_sessions", indexes = {
        @Index(name = "idx_portal_session_account", columnList = "account_id,revoked,expires_at")
})
@Getter
@Setter
@NoArgsConstructor
public class ClientPortalSession extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "account_id", nullable = false)
    private ClientPortalAccount account;

    @Column(name = "token_hash", nullable = false, unique = true, length = 64)
    private String tokenHash;

    @Column(nullable = false)
    private boolean revoked;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;
}
