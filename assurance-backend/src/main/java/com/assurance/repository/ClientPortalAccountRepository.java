package com.assurance.repository;

import com.assurance.entity.ClientPortalAccount;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.Optional;
import java.util.List;

public interface ClientPortalAccountRepository extends JpaRepository<ClientPortalAccount, Long> {
    @EntityGraph(attributePaths = {"client", "agence"})
    Page<ClientPortalAccount> findByAgenceId(Long agenceId, Pageable pageable);

    @EntityGraph(attributePaths = {"client", "agence"})
    Optional<ClientPortalAccount> findByIdAndAgenceId(Long id, Long agenceId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from ClientPortalAccount a join fetch a.client join fetch a.agence where a.agence.code = :agency and a.identifiant = :login")
    Optional<ClientPortalAccount> findForLogin(@Param("agency") String agency, @Param("login") String login);

    // Authentication-only global lookup; operational account reads remain agency-scoped.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from ClientPortalAccount a join fetch a.client join fetch a.agence where a.identifiant = :login order by a.id")
    List<ClientPortalAccount> findForGlobalLogin(@Param("login") String login, Pageable pageable);

    boolean existsByIdentifiant(String identifiant);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from ClientPortalAccount a where a.id = :id and a.agence.id = :agency")
    Optional<ClientPortalAccount> findForUpdate(@Param("id") Long id, @Param("agency") Long agency);

    boolean existsByAgenceIdAndIdentifiant(Long agenceId, String identifiant);
    boolean existsByAgenceIdAndClientId(Long agenceId, Long clientId);

    @EntityGraph(attributePaths = {"client", "agence"})
    Optional<ClientPortalAccount> findByAgenceIdAndClientId(Long agenceId, Long clientId);
}
