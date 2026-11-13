package com.assurance.repository;

import com.assurance.entity.SpecialitePrestataireSinistre;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;
import java.util.List;
import java.util.Optional;

public interface SpecialitePrestataireSinistreRepository extends JpaRepository<SpecialitePrestataireSinistre, Long> {
    @EntityGraph(attributePaths = "garanties")
    List<SpecialitePrestataireSinistre> findByAgenceIdOrderByLibelleAsc(Long agenceId);

    Optional<SpecialitePrestataireSinistre> findByIdAndAgenceId(Long id, Long agenceId);

    boolean existsByAgenceIdAndCodeIgnoreCaseAndIdNot(Long agenceId, String code, Long id);
}
