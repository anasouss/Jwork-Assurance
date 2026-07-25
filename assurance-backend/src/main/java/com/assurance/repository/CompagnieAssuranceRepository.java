package com.assurance.repository;

import com.assurance.entity.CompagnieAssurance;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CompagnieAssuranceRepository extends JpaRepository<CompagnieAssurance, String> {
    Optional<CompagnieAssurance> findByCode(String code);
}
