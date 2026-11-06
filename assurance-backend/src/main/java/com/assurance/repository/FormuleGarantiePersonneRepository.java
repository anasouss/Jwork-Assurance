package com.assurance.repository;

import com.assurance.entity.FormuleGarantiePersonne;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Set;
import java.util.Optional;

public interface FormuleGarantiePersonneRepository extends JpaRepository<FormuleGarantiePersonne, Long> {
    @Query("select f from FormuleGarantiePersonne f where f.id = :id and (f.grilleTarifaire.agence is null or f.grilleTarifaire.agence.id = :agenceId)")
    Optional<FormuleGarantiePersonne> findAccessibleById(@Param("agenceId") Long agenceId, @Param("id") Long id);

    @EntityGraph(attributePaths = {"grilleTarifaire", "garantie", "usage"})
    @Query("""
            select f from FormuleGarantiePersonne f
            where f.grilleTarifaire.id = :grilleId and f.actif = true
              and (f.grilleTarifaire.agence is null or f.grilleTarifaire.agence.id = :agenceId)
              and (:usageId is null or f.usage is null or f.usage.id = :usageId)
              and (:garantieId is null or f.garantie.id = :garantieId)
            order by f.ordreAffichage, f.formule
            """)
    List<FormuleGarantiePersonne> findAccessibleOptions(@Param("agenceId") Long agenceId, @Param("grilleId") Long grilleId,
            @Param("usageId") Long usageId, @Param("garantieId") Long garantieId);

    @Override
    @EntityGraph(attributePaths = {"grilleTarifaire", "garantie", "usage"})
    List<FormuleGarantiePersonne> findAll(Sort sort);

    @EntityGraph(attributePaths = {"grilleTarifaire", "garantie", "usage"})
    List<FormuleGarantiePersonne> findByGrilleTarifaireIdAndUsageIdAndActifTrue(Long grilleTarifaireId, Long usageId);

    @EntityGraph(attributePaths = {"grilleTarifaire", "usage"})
    List<FormuleGarantiePersonne> findByGrilleTarifaireIdInAndActifTrue(Set<Long> grilleTarifaireIds);

    @EntityGraph(attributePaths = {"grilleTarifaire", "garantie", "usage"})
    List<FormuleGarantiePersonne> findByGrilleTarifaireIdAndUsageIdAndGarantieIdAndActifTrueOrderByOrdreAffichageAscFormuleAsc(
            Long grilleTarifaireId,
            Long usageId,
            Long garantieId
    );

    @EntityGraph(attributePaths = {"grilleTarifaire", "garantie", "usage"})
    List<FormuleGarantiePersonne> findByGrilleTarifaireIdAndGarantieIdAndActifTrueOrderByOrdreAffichageAscFormuleAsc(
            Long grilleTarifaireId,
            Long garantieId
    );
}
