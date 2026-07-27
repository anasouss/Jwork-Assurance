package com.assurance.repository;

import com.assurance.entity.MouvementVehicule;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MouvementVehiculeRepository extends JpaRepository<MouvementVehicule, Long> {
    void deleteByMouvementContratId(Long mouvementContratId);
}
