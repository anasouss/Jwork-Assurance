package com.assurance.repository;

import com.assurance.entity.SeuilStockAttestation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SeuilStockAttestationRepository extends JpaRepository<SeuilStockAttestation, Long> {
    Optional<SeuilStockAttestation> findByCompagnieAssuranceIdAndGroupeUsageAttestationIdAndActifTrue(Long compagnieAssuranceId, Long groupeUsageAttestationId);
}
