package com.assurance.repository;

import com.assurance.entity.FormuleGarantiePersonne;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Set;

public interface FormuleGarantiePersonneRepository extends JpaRepository<FormuleGarantiePersonne, Long> {
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
