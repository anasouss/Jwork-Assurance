package com.assurance.repository;

import com.assurance.entity.MouvementVehicule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MouvementVehiculeRepository extends JpaRepository<MouvementVehicule, Long> {
    List<MouvementVehicule> findByMouvementContratId(Long mouvementContratId);

    void deleteByMouvementContratId(Long mouvementContratId);
}
