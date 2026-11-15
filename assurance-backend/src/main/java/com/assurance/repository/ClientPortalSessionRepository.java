package com.assurance.repository;

import com.assurance.entity.ClientPortalSession;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.time.LocalDateTime;
import java.util.Optional;

public interface ClientPortalSessionRepository extends JpaRepository<ClientPortalSession, Long> {
    interface RefreshOwner {
        Long getAccountId();
        Long getAgenceId();
    }

    @Query("select s.account.id as accountId, s.account.agence.id as agenceId from ClientPortalSession s where s.tokenHash = :hash")
    Optional<RefreshOwner> findRefreshOwner(@Param("hash") String hash);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from ClientPortalSession s where s.tokenHash = :hash")
    Optional<ClientPortalSession> findForRefresh(@Param("hash") String hash);

    @EntityGraph(attributePaths = {"account", "account.client", "account.agence", "account.client.agence"})
    @Query("select s from ClientPortalSession s where s.id = :id and s.account.id = :account and s.account.agence.id = :agency and s.revoked = false and s.expiresAt > :now")
    Optional<ClientPortalSession> findValid(@Param("id") Long id, @Param("account") Long account,
                                          @Param("agency") Long agency, @Param("now") LocalDateTime now);

    @Modifying
    @Query("update ClientPortalSession s set s.revoked = true where s.account.id = :account")
    void revokeAll(@Param("account") Long account);
}
