package com.assurance.repository;

import com.assurance.entity.CompagnieGarantie;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CompagnieGarantieRepository extends JpaRepository<CompagnieGarantie, Long> {
    Optional<CompagnieGarantie> findByCompagnieAssuranceIdAndGarantieId(Long compagnieAssuranceId, Long garantieId);
    List<CompagnieGarantie> findByCompagnieAssuranceIdAndActifTrue(Long compagnieAssuranceId);
}
