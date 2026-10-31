package com.assurance.repository;

import com.assurance.entity.QuittancePrimeSelection;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface QuittancePrimeSelectionRepository extends JpaRepository<QuittancePrimeSelection, Long> {
    Optional<QuittancePrimeSelection> findByAgenceIdAndReglementIdAndSelectionHash(Long agenceId, Long reglementId, String hash);

    Optional<QuittancePrimeSelection> findByIdAndAgenceIdAndReglementId(Long id, Long agenceId, Long reglementId);

    List<QuittancePrimeSelection> findByAgenceIdAndReglementIdOrderByIdDesc(Long agenceId, Long reglementId);
}
