package com.assurance.repository;

import com.assurance.entity.ExpertSinistre;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ExpertSinistreRepository extends JpaRepository<ExpertSinistre, Long>, org.springframework.data.jpa.repository.JpaSpecificationExecutor<ExpertSinistre> {

    boolean existsBySpecialitesId(Long specialiteId);

    @EntityGraph(attributePaths = "ville")
    List<ExpertSinistre> findByAgenceIdAndActifTrueOrderByNomAsc(Long agenceId);

    @EntityGraph(attributePaths = "ville")
    List<ExpertSinistre> findByAgenceIdOrderByNomAsc(Long agenceId);

    @EntityGraph(attributePaths = "ville")
    List<ExpertSinistre> findByAgenceIdAndVilleIdOrderByNomAsc(Long agenceId, Long villeId);

    @EntityGraph(attributePaths = "ville")
    List<ExpertSinistre> findByAgenceIdAndVilleIdAndActifTrueOrderByNomAsc(Long agenceId, Long villeId);

    Optional<ExpertSinistre> findByIdAndAgenceId(Long id, Long agenceId);

    boolean existsByAgenceIdAndCodeIgnoreCase(Long agenceId, String code);

    boolean existsByAgenceIdAndCodeIgnoreCaseAndIdNot(Long agenceId, String code, Long id);
}
