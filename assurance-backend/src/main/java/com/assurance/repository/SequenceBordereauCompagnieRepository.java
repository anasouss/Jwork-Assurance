package com.assurance.repository;

import com.assurance.entity.SequenceBordereauCompagnie;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

import java.util.Optional;

public interface SequenceBordereauCompagnieRepository
        extends JpaRepository<SequenceBordereauCompagnie, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<SequenceBordereauCompagnie> findByAgenceIdAndAnnee(Long agenceId, Integer annee);
}
