package com.assurance.repository;

import com.assurance.entity.SequenceOperationTresorerie;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

import java.util.Optional;

public interface SequenceOperationTresorerieRepository
        extends JpaRepository<SequenceOperationTresorerie, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<SequenceOperationTresorerie> findByAgenceIdAndAnnee(Long agenceId, Integer annee);
}
