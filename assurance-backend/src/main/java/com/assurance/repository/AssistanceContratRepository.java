package com.assurance.repository;

import com.assurance.entity.AssistanceContrat;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface AssistanceContratRepository extends JpaRepository<AssistanceContrat, Long> {
    List<AssistanceContrat> findByContratIdOrderByCreatedAtDesc(Long contratId);

    List<AssistanceContrat> findByContratIdAndActifTrueOrderByCreatedAtDesc(Long contratId);

    List<AssistanceContrat> findByMouvementContratIdOrderByCreatedAtDesc(Long mouvementContratId);

    List<AssistanceContrat> findByMouvementContratIdAndActifTrueOrderByCreatedAtDesc(Long mouvementContratId);

    long countByMouvementContratIdAndActifTrue(Long mouvementContratId);

    long countByContratIdAndActifTrue(Long contratId);

    Optional<AssistanceContrat> findFirstByContratIdAndVehiculeIdAndActifTrueOrderByCreatedAtDesc(Long contratId, Long vehiculeId);

    @EntityGraph(attributePaths = {"compagnieAssistance", "produitAssistance", "elementFacturable"})
    @Query("""
            select a
            from AssistanceContrat a
            where a.elementFacturable.id in :elementIds
              and a.actif = true
            """)
    List<AssistanceContrat> findActiveByElementFacturableIds(
            @Param("elementIds") Collection<Long> elementIds
    );
}
