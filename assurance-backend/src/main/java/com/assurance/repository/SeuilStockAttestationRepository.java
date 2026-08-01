package com.assurance.repository;

import com.assurance.entity.SeuilStockAttestation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SeuilStockAttestationRepository extends JpaRepository<SeuilStockAttestation, Long> {
    Optional<SeuilStockAttestation> findByAgenceIdAndCompagnieAssuranceIdAndGroupeUsageAttestationIdAndActifTrue(
            Long agenceId,
            Long compagnieAssuranceId,
            Long groupeUsageAttestationId
    );

    Optional<SeuilStockAttestation> findByIdAndAgenceIdAndActifTrue(Long id, Long agenceId);

    List<SeuilStockAttestation> findByAgenceIdAndActifTrueOrderByCompagnieAssuranceNomAscGroupeUsageAttestationCodeAsc(
            Long agenceId
    );
}
