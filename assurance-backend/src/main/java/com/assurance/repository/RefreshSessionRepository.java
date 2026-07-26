package com.assurance.repository;

import com.assurance.entity.RefreshSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface RefreshSessionRepository extends JpaRepository<RefreshSession, Long> {

    Optional<RefreshSession> findByToken(String token);

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
