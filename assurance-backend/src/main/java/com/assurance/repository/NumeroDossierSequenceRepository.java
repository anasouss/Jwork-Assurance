package com.assurance.repository;

import com.assurance.entity.NumeroDossierSequence;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

import java.util.Optional;

public interface NumeroDossierSequenceRepository extends JpaRepository<NumeroDossierSequence, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<NumeroDossierSequence> findByAgenceIdAndCompagnieAssuranceIdAndAnnee(
            Long agenceId,
            Long compagnieAssuranceId,
            Integer annee
    );
}
