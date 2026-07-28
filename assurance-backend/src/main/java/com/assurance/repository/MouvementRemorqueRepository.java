package com.assurance.repository;

import com.assurance.entity.MouvementRemorque;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MouvementRemorqueRepository extends JpaRepository<MouvementRemorque, Long> {
    List<MouvementRemorque> findByMouvementContratId(Long mouvementContratId);

    void deleteByMouvementContratId(Long mouvementContratId);
}
