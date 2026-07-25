package com.assurance.repository;

import com.assurance.entity.CompagnieAssistance;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CompagnieAssistanceRepository extends JpaRepository<CompagnieAssistance, String> {
    Optional<CompagnieAssistance> findByCodeIgnoreCase(String code);
}
