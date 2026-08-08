package com.assurance.repository;

import com.assurance.entity.SequenceReglementCompagnie;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

import java.util.Optional;

public interface SequenceReglementCompagnieRepository
        extends JpaRepository<SequenceReglementCompagnie, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<SequenceReglementCompagnie> findByAgenceIdAndAnnee(Long agenceId, Integer annee);
}
