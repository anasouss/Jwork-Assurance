package com.assurance.repository;

import com.assurance.entity.MouvementGarantie;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MouvementGarantieRepository extends JpaRepository<MouvementGarantie, Long> {
    List<MouvementGarantie> findByMouvementContratId(Long mouvementContratId);

    void deleteByMouvementContratId(Long mouvementContratId);
}
