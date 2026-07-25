package com.assurance.repository;

import com.assurance.entity.CompagnieGarantie;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CompagnieGarantieRepository extends JpaRepository<CompagnieGarantie, String> {
    Optional<CompagnieGarantie> findByCompagnieAssuranceIdAndGarantieId(String compagnieAssuranceId, String garantieId);
    List<CompagnieGarantie> findByCompagnieAssuranceIdAndActifTrue(String compagnieAssuranceId);
}
