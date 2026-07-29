package com.assurance.repository;

import com.assurance.entity.CarteVerte;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CarteVerteRepository extends JpaRepository<CarteVerte, Long> {
    List<CarteVerte> findByContratIdOrderByCreatedAtDesc(Long contratId);

    List<CarteVerte> findByContratIdAndActifTrueOrderByCreatedAtDesc(Long contratId);

    List<CarteVerte> findByMouvementContratIdAndActifTrueOrderByCreatedAtDesc(Long mouvementContratId);

    long countByMouvementContratId(Long mouvementContratId);

    Optional<CarteVerte> findFirstByContratIdAndVehiculeIdAndActifTrueOrderByCreatedAtDesc(Long contratId, Long vehiculeId);
}
