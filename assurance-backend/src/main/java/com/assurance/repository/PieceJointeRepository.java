package com.assurance.repository;

import com.assurance.entity.PieceJointe;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PieceJointeRepository extends JpaRepository<PieceJointe, Long> {
    List<PieceJointe> findByAgenceIdAndClientIdOrderByCreatedAtDesc(Long agenceId, Long clientId);
    List<PieceJointe> findByAgenceIdAndVehiculeIdOrderByCreatedAtDesc(Long agenceId, Long vehiculeId);

    boolean existsByPreviousVersionId(Long previousVersionId);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select p from PieceJointe p where p.agence.id = :agenceId and p.id = :id")
    java.util.Optional<PieceJointe> lockOwned(@org.springframework.data.repository.query.Param("agenceId") Long agenceId,
                                           @org.springframework.data.repository.query.Param("id") Long id);
    List<PieceJointe> findByContratIdOrderByCreatedAtDesc(Long contratId);

    List<PieceJointe> findByContratIdAndMouvementContratIdOrderByCreatedAtDesc(Long contratId, Long mouvementContratId);

    long countByMouvementContratId(Long mouvementContratId);

    @org.springframework.data.jpa.repository.Query("select count(u) from DocumentUsage u where u.mouvement.id = :mouvementId")
    long countDocumentUsagesByMouvementId(@org.springframework.data.repository.query.Param("mouvementId") Long mouvementId);

    List<PieceJointe> findByContratIdAndMouvementContratIsNullOrderByCreatedAtDesc(Long contratId);
}
