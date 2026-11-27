package com.assurance.repository;

import com.assurance.entity.PieceJointe;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PieceJointeRepository extends JpaRepository<PieceJointe, Long> {
    @org.springframework.data.jpa.repository.Query("""
            select p from PieceJointe p
            join fetch p.typePieceJointe t
            join fetch t.naturePieceJointe n
            where p.contrat.agence.id = :agency and (p.agence is null or p.agence.id = :agency)
              and p.vehicule.id = :vehicle
              and p.documentOwner = com.assurance.enums.DocumentOwner.VEHICULE
              and (p.archived = false or p.archived is null)
            order by p.id
            """)
    List<PieceJointe> findClaimVehicleCandidates(
            @org.springframework.data.repository.query.Param("agency") Long agency,
            @org.springframework.data.repository.query.Param("vehicle") Long vehicle);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("""
            select p from PieceJointe p where p.id = :id
              and p.contrat.agence.id = :agency and (p.agence is null or p.agence.id = :agency)
            """)
    java.util.Optional<PieceJointe> lockClaimSource(
            @org.springframework.data.repository.query.Param("agency") Long agency,
            @org.springframework.data.repository.query.Param("id") Long id);

    @org.springframework.data.jpa.repository.Query("select count(d) > 0 from SinistreDocument d where d.sourcePieceJointe.id = :pieceId")
    boolean hasClaimReferences(@org.springframework.data.repository.query.Param("pieceId") Long pieceId);
    @org.springframework.data.jpa.repository.Query("select p from PieceJointe p where p.contrat.id = :contract and p.contrat.agence.id = :agency and (p.agence is null or p.agence.id = :agency) and (p.archived = false or p.archived is null) order by p.id desc")
    org.springframework.data.domain.Page<PieceJointe> findPortalSources(
            @org.springframework.data.repository.query.Param("agency") Long agency,
            @org.springframework.data.repository.query.Param("contract") Long contract,
            org.springframework.data.domain.Pageable pageable);
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
