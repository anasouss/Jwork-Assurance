package com.assurance.repository;

import com.assurance.entity.AssistanceContrat;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AssistanceContratRepository extends JpaRepository<AssistanceContrat, String> {
    List<AssistanceContrat> findByContratIdOrderByCreatedAtDesc(String contratId);

    Optional<AssistanceContrat> findFirstByContratIdAndVehiculeIdAndActifTrueOrderByCreatedAtDesc(String contratId, String vehiculeId);
}
