package com.assurance.repository;

import com.assurance.entity.Convention;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ConventionRepository extends JpaRepository<Convention, Long> {
    Optional<Convention> findByAgenceIdAndId(Long agenceId, Long id);

    @EntityGraph(attributePaths = {"compagnieAssurance", "categorieClient", "grilleTarifaire", "usages"})
    List<Convention> findByAgenceIdAndActifTrueOrderByIntituleAsc(Long agenceId);

    @EntityGraph(attributePaths = {"compagnieAssurance", "categorieClient", "grilleTarifaire", "usages"})
    List<Convention> findByAgenceIdAndCompagnieAssuranceIdAndActifTrueOrderByIntituleAsc(Long agenceId, Long compagnieAssuranceId);
}
