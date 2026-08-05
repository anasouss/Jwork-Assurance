package com.assurance.repository;

import com.assurance.entity.SequenceSinistre;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

import java.util.Optional;

public interface SequenceSinistreRepository extends JpaRepository<SequenceSinistre, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<SequenceSinistre> findByAgenceIdAndAnnee(Long agenceId, int annee);
}
