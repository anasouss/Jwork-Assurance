package com.assurance.repository;

import com.assurance.entity.MouvementVehicule;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MouvementVehiculeRepository extends JpaRepository<MouvementVehicule, Long> {
    @EntityGraph(attributePaths = "marque")
    List<MouvementVehicule> findByMouvementContratId(Long mouvementContratId);

    void deleteByMouvementContratId(Long mouvementContratId);
}
