package com.assurance.repository;

import com.assurance.entity.RefreshSession;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface RefreshSessionRepository extends JpaRepository<RefreshSession, Long> {

    Optional<RefreshSession> findByToken(String token);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select rt from RefreshSession rt where rt.token = :token")
    Optional<RefreshSession> findByTokenForUpdate(@Param("token") String token);

    @Query("""
            select case when count(rt) > 0 then true else false end
            from RefreshSession rt
            where rt.id = :sessionId
              and rt.user.id = :userId
              and rt.revoked = false
              and rt.expiresAt > :now
              and (
                    (:agenceId is null and rt.effectiveAgence is null)
                    or rt.effectiveAgence.id = :agenceId
              )
            """)
    boolean existsValidContext(
            @Param("sessionId") Long sessionId,
            @Param("userId") Long userId,
            @Param("agenceId") Long agenceId,
            @Param("now") LocalDateTime now
    );

    List<RefreshSession> findByUserIdAndRevokedFalseAndExpiresAtAfterOrderByLastActivityAtDesc(
            Long userId,
            LocalDateTime now
    );

    @Modifying
    @Query("update RefreshSession rt set rt.revoked = true where rt.user.id = :userId")
    void revokeAllByUserId(@Param("userId") Long userId);

    @Modifying
    @Query("update RefreshSession rt set rt.revoked = true where rt.user.id = :userId and rt.id <> :currentSessionId")
    void revokeAllByUserIdExcept(@Param("userId") Long userId, @Param("currentSessionId") Long currentSessionId);
}
