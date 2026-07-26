package com.assurance.repository;

import com.assurance.entity.Vehicule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface VehiculeRepository extends JpaRepository<Vehicule, Long> {
    void deleteByContratId(Long contratId);

    List<Vehicule> findByContratIdOrderByCreatedAtAsc(Long contratId);

    Optional<Vehicule> findFirstByContratAgenceIdAndImmatriculationIgnoreCaseOrderByCreatedAtDesc(Long agenceId, String immatriculation);
}
