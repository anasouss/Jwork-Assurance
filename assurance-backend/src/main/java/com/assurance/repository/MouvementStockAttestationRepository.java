package com.assurance.repository;

import com.assurance.entity.MouvementStockAttestation;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MouvementStockAttestationRepository extends JpaRepository<MouvementStockAttestation, Long> {
    long countByMouvementContratId(Long mouvementContratId);
}
