package com.assurance.repository;

import com.assurance.entity.SequenceBordereauRemise;
import com.assurance.enums.TypeBordereauRemise;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

import java.util.Optional;

public interface SequenceBordereauRemiseRepository extends JpaRepository<SequenceBordereauRemise, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<SequenceBordereauRemise> findByAgenceIdAndTypeAndAnnee(
            Long agenceId,
            TypeBordereauRemise type,
            Integer annee
    );
}
