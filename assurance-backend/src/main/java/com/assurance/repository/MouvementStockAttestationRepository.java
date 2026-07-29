package com.assurance.repository;

import com.assurance.entity.MouvementStockAttestation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MouvementStockAttestationRepository extends JpaRepository<MouvementStockAttestation, Long> {
    List<MouvementStockAttestation> findByMouvementContratIdOrderByCreatedAtDesc(Long mouvementContratId);

    void deleteByMouvementContratId(Long mouvementContratId);
}
