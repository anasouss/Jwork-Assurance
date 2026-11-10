package com.assurance.repository;

import com.assurance.entity.AgenceCompagnieAssistance;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AgenceCompagnieAssistanceRepository extends JpaRepository<AgenceCompagnieAssistance, Long> {

    @EntityGraph(attributePaths = "compagnieAssistance")
    List<AgenceCompagnieAssistance> findByAgenceId(Long agenceId);

    Optional<AgenceCompagnieAssistance> findByAgenceIdAndCompagnieAssistanceId(
            Long agenceId,
            Long compagnieAssistanceId
    );
}
