package com.assurance.repository;

import com.assurance.entity.Convention;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ConventionRepository extends JpaRepository<Convention, String> {
    Optional<Convention> findByAgenceIdAndId(String agenceId, String id);

    @EntityGraph(attributePaths = {"compagnieAssurance", "categorieClient", "grilleTarifaire", "usages"})
    List<Convention> findByAgenceIdAndActifTrueOrderByIntituleAsc(String agenceId);

    @EntityGraph(attributePaths = {"compagnieAssurance", "categorieClient", "grilleTarifaire", "usages"})
    List<Convention> findByAgenceIdAndCompagnieAssuranceIdAndActifTrueOrderByIntituleAsc(String agenceId, String compagnieAssuranceId);
}
