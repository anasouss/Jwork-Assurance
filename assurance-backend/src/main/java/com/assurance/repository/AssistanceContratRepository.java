package com.assurance.repository;

import com.assurance.entity.AssistanceContrat;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AssistanceContratRepository extends JpaRepository<AssistanceContrat, Long> {
    List<AssistanceContrat> findByContratIdOrderByCreatedAtDesc(Long contratId);

    List<AssistanceContrat> findByContratIdAndActifTrueOrderByCreatedAtDesc(Long contratId);

    long countByMouvementContratId(Long mouvementContratId);

    Optional<AssistanceContrat> findFirstByContratIdAndVehiculeIdAndActifTrueOrderByCreatedAtDesc(Long contratId, Long vehiculeId);
}
