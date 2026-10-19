package com.assurance.repository;

import com.assurance.entity.AgenceCompagnieAssurance;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AgenceCompagnieAssuranceRepository extends JpaRepository<AgenceCompagnieAssurance, Long> {

    @EntityGraph(attributePaths = "compagnieAssurance")
    List<AgenceCompagnieAssurance> findByAgenceId(Long agenceId);

    Optional<AgenceCompagnieAssurance> findByAgenceIdAndCompagnieAssuranceId(
            Long agenceId,
            Long compagnieAssuranceId
    );
}
