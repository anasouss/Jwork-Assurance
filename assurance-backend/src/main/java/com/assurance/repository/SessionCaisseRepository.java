package com.assurance.repository;

import com.assurance.entity.SessionCaisse;
import com.assurance.enums.StatutSessionCaisse;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

import java.util.List;
import java.util.Optional;

public interface SessionCaisseRepository extends JpaRepository<SessionCaisse, Long> {

    boolean existsByAgenceIdAndCompteTresorerieIdAndStatut(
            Long agenceId,
            Long compteId,
            StatutSessionCaisse statut
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<SessionCaisse> findFirstByAgenceIdAndCompteTresorerieIdAndStatut(
            Long agenceId,
            Long compteId,
            StatutSessionCaisse statut
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<SessionCaisse> findFirstByAgenceIdAndCompteTresorerieIdAndUtilisateurIdAndStatut(
            Long agenceId,
            Long compteId,
            Long utilisateurId,
            StatutSessionCaisse statut
    );

    @EntityGraph(attributePaths = {"compteTresorerie", "utilisateur"})
    List<SessionCaisse> findTop100ByAgenceIdOrderByOuverteLeDesc(Long agenceId);

    @EntityGraph(attributePaths = {"compteTresorerie", "utilisateur"})
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<SessionCaisse> findByIdAndAgenceId(Long id, Long agenceId);
}
