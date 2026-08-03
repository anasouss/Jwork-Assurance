package com.assurance.repository;

import com.assurance.entity.LivraisonAttestation;
import com.assurance.enums.SourceLivraisonAttestation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface LivraisonAttestationRepository extends JpaRepository<LivraisonAttestation, Long> {
    @Query("""
            SELECT livraison
            FROM LivraisonAttestation livraison
            WHERE livraison.agence.id = :agenceId
              AND livraison.source = :source
              AND livraison.actif = true
              AND (:compagnieAssuranceId IS NULL OR livraison.compagnieAssurance.id = :compagnieAssuranceId)
              AND (:dateDu IS NULL OR livraison.dateReception >= :dateDu)
              AND (:dateAu IS NULL OR livraison.dateReception <= :dateAu)
            ORDER BY livraison.createdAt DESC
            """)
    List<LivraisonAttestation> searchActive(
            @Param("agenceId") Long agenceId,
            @Param("source") SourceLivraisonAttestation source,
            @Param("compagnieAssuranceId") Long compagnieAssuranceId,
            @Param("dateDu") LocalDate dateDu,
            @Param("dateAu") LocalDate dateAu
    );

    Optional<LivraisonAttestation> findByIdAndAgenceIdAndActifTrue(Long id, Long agenceId);
}
