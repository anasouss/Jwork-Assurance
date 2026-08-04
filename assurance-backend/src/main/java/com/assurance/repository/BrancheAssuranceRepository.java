package com.assurance.repository;

import com.assurance.entity.BrancheAssurance;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface BrancheAssuranceRepository extends JpaRepository<BrancheAssurance, Long> {
    Optional<BrancheAssurance> findByCodeIgnoreCase(String code);
    List<BrancheAssurance> findAllByActifTrueOrderByLibelleAsc();
}
