package com.assurance.repository;

import com.assurance.entity.DomaineInterventionSinistre;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;
import java.util.List;
import java.util.Optional;

public interface DomaineInterventionSinistreRepository extends JpaRepository<DomaineInterventionSinistre, Long> {
    @EntityGraph(attributePaths = {"brancheAssurance", "operateurs"})
    List<DomaineInterventionSinistre> findByAgenceIdOrderByLibelleAsc(Long agenceId);

    @EntityGraph(attributePaths = {"brancheAssurance", "operateurs"})
    Optional<DomaineInterventionSinistre> findByIdAndAgenceId(Long id, Long agenceId);

    boolean existsByAgenceIdAndCodeIgnoreCaseAndIdNot(Long agenceId, String code, Long id);
}
