package com.assurance.repository;

import com.assurance.entity.GroupeUsageAttestation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface GroupeUsageAttestationRepository extends JpaRepository<GroupeUsageAttestation, Long> {
    Optional<GroupeUsageAttestation> findByCodeIgnoreCase(String code);
}
