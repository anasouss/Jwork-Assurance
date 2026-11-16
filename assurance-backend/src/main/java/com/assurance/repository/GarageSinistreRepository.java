package com.assurance.repository;

import com.assurance.entity.GarageSinistre;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface GarageSinistreRepository extends JpaRepository<GarageSinistre, Long>, org.springframework.data.jpa.repository.JpaSpecificationExecutor<GarageSinistre> {

    boolean existsBySpecialitesId(Long specialiteId);
    boolean existsByDomainesId(Long domaineId);

    @EntityGraph(attributePaths = "ville")
    List<GarageSinistre> findByAgenceIdAndActifTrueOrderByRaisonSocialeAsc(Long agenceId);

    @EntityGraph(attributePaths = "ville")
    List<GarageSinistre> findByAgenceIdOrderByRaisonSocialeAsc(Long agenceId);

    Optional<GarageSinistre> findByIdAndAgenceId(Long id, Long agenceId);

    @EntityGraph(attributePaths = {"ville", "domaines", "specialites", "accords", "accords.compagnie"})
    List<GarageSinistre> findByAgenceIdAndIdIn(Long agenceId, List<Long> ids);

    boolean existsByAgenceIdAndCodeIgnoreCase(Long agenceId, String code);

    boolean existsByAgenceIdAndCodeIgnoreCaseAndIdNot(Long agenceId, String code, Long id);
}
