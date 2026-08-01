package com.assurance.repository;

import com.assurance.entity.GrilleTarifaire;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface GrilleTarifaireRepository extends JpaRepository<GrilleTarifaire, Long> {
    @Query("""
            select grille
            from GrilleTarifaire grille
            where grille.id = :id
              and (grille.agence is null or grille.agence.id = :agenceId)
            """)
    Optional<GrilleTarifaire> findAccessibleById(
            @Param("agenceId") Long agenceId,
            @Param("id") Long id
    );

    @EntityGraph(attributePaths = "compagnieAssurance")
    List<GrilleTarifaire> findAllByOrderByCreatedAtDesc();

    @EntityGraph(attributePaths = "compagnieAssurance")
    List<GrilleTarifaire> findByCompagnieAssuranceIdAndActifTrueOrderByCreatedAtDesc(Long compagnieAssuranceId);

    @EntityGraph(attributePaths = "compagnieAssurance")
    List<GrilleTarifaire> findByCompagnieAssuranceIdAndActifTrueOrderByLibelleAsc(Long compagnieAssuranceId);
}
