package com.assurance.repository;

import com.assurance.entity.GrilleTarifaire;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.domain.Sort;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface GrilleTarifaireRepository extends JpaRepository<GrilleTarifaire, Long> {
    @EntityGraph(attributePaths = "compagnieAssurance")
    @Query("select g from GrilleTarifaire g where g.actif = true and (g.agence is null or g.agence.id = :agenceId) and (:compagnieId is null or g.compagnieAssurance.id = :compagnieId)")
    List<GrilleTarifaire> findAccessibleByCompany(@Param("agenceId") Long agenceId, @Param("compagnieId") Long compagnieId, Sort sort);

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
    @Query("""
            select grille
            from GrilleTarifaire grille
            where grille.agence is null or grille.agence.id = :agenceId
            """)
    List<GrilleTarifaire> findAccessibleAll(@Param("agenceId") Long agenceId);

    @EntityGraph(attributePaths = "compagnieAssurance")
    List<GrilleTarifaire> findAllByOrderByCreatedAtDesc();

    @EntityGraph(attributePaths = "compagnieAssurance")
    List<GrilleTarifaire> findByCompagnieAssuranceIdAndActifTrueOrderByCreatedAtDesc(Long compagnieAssuranceId);

    @EntityGraph(attributePaths = "compagnieAssurance")
    List<GrilleTarifaire> findByCompagnieAssuranceIdAndActifTrueOrderByLibelleAsc(Long compagnieAssuranceId);
}
