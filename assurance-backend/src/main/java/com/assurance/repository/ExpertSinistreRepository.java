package com.assurance.repository;

import com.assurance.entity.ExpertSinistre;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ExpertSinistreRepository extends JpaRepository<ExpertSinistre, Long> {

    @EntityGraph(attributePaths = "ville")
    List<ExpertSinistre> findByAgenceIdAndActifTrueOrderByNomAsc(Long agenceId);

    @EntityGraph(attributePaths = "ville")
    List<ExpertSinistre> findByAgenceIdOrderByNomAsc(Long agenceId);

    Optional<ExpertSinistre> findByIdAndAgenceId(Long id, Long agenceId);

    boolean existsByAgenceIdAndCodeIgnoreCase(Long agenceId, String code);

    boolean existsByAgenceIdAndCodeIgnoreCaseAndIdNot(Long agenceId, String code, Long id);
}
