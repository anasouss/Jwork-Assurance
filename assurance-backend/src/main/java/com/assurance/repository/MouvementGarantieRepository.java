package com.assurance.repository;

import com.assurance.entity.MouvementGarantie;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MouvementGarantieRepository extends JpaRepository<MouvementGarantie, Long> {
    void deleteByMouvementContratId(Long mouvementContratId);
}
