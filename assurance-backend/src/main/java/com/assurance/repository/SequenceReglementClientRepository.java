package com.assurance.repository;

import com.assurance.entity.SequenceReglementClient;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

import java.util.Optional;

public interface SequenceReglementClientRepository extends JpaRepository<SequenceReglementClient, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<SequenceReglementClient> findByAgenceIdAndAnnee(Long agenceId, Integer annee);
}
