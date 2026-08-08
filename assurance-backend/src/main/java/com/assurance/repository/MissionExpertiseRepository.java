package com.assurance.repository;

import com.assurance.entity.MissionExpertise;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MissionExpertiseRepository extends JpaRepository<MissionExpertise, Long> {

    @EntityGraph(attributePaths = {"expert", "garage"})
    List<MissionExpertise> findBySinistreIdOrderByDateMissionDescCreatedAtDesc(Long sinistreId);

    Optional<MissionExpertise> findByIdAndSinistreId(Long id, Long sinistreId);

    boolean existsBySinistreIdAndExpertId(Long sinistreId, Long expertId);

    boolean existsBySinistreIdAndGarageId(Long sinistreId, Long garageId);
}
