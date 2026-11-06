package com.assurance.repository;

import com.assurance.entity.LigneGrilleTarifaire;
import com.assurance.enums.ModeTarificationGarantie;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.Set;

public interface LigneGrilleTarifaireRepository extends JpaRepository<LigneGrilleTarifaire, Long> {
    @EntityGraph(attributePaths = {"grilleTarifaire", "garantie", "usage"})
    @Query("""
            select l from LigneGrilleTarifaire l
            where l.grilleTarifaire.id = :grilleId and l.actif = true
              and (l.grilleTarifaire.agence is null or l.grilleTarifaire.agence.id = :agenceId)
              and (:usageId is null or l.usage is null or l.usage.id = :usageId)
              and (:garantieId is null or l.garantie.id = :garantieId)
            """)
    List<LigneGrilleTarifaire> findAccessibleOptions(@Param("agenceId") Long agenceId, @Param("grilleId") Long grilleId,
            @Param("usageId") Long usageId, @Param("garantieId") Long garantieId);

    @Query("""
            select ligne
            from LigneGrilleTarifaire ligne
            where ligne.id = :id
              and (ligne.grilleTarifaire.agence is null or ligne.grilleTarifaire.agence.id = :agenceId)
            """)
    Optional<LigneGrilleTarifaire> findAccessibleById(
            @Param("agenceId") Long agenceId,
            @Param("id") Long id
    );

    List<LigneGrilleTarifaire> findByGrilleTarifaireIdAndActifTrue(Long grilleTarifaireId);

    @EntityGraph(attributePaths = {"grilleTarifaire", "usage"})
    List<LigneGrilleTarifaire> findByGrilleTarifaireIdInAndActifTrue(Set<Long> grilleTarifaireIds);

    List<LigneGrilleTarifaire> findByGrilleTarifaireIdAndUsageIdAndActifTrue(Long grilleTarifaireId, Long usageId);

    List<LigneGrilleTarifaire> findByGrilleTarifaireIdAndUsageIdAndGarantieIdAndActifTrueOrderByOrdreAffichageAsc(
            Long grilleTarifaireId,
            Long usageId,
            Long garantieId
    );

    List<LigneGrilleTarifaire> findByGrilleTarifaireIdAndUsageIdAndGarantieResponsabiliteCivileTrueAndActifTrueOrderByOrdreAffichageAsc(
            Long grilleTarifaireId,
            Long usageId
    );

    List<LigneGrilleTarifaire> findByGrilleTarifaireIdAndUsageIdAndGarantieIdAndModeTarificationAndActifTrueOrderByOrdreAffichageAsc(
            Long grilleTarifaireId,
            Long usageId,
            Long garantieId,
            ModeTarificationGarantie modeTarification
    );
}
