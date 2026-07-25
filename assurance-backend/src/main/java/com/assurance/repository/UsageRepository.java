package com.assurance.repository;

import com.assurance.entity.Usage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UsageRepository extends JpaRepository<Usage, String> {
    Optional<Usage> findByCodeIgnoreCase(String code);
    Optional<Usage> findByLibelleIgnoreCase(String libelle);
}
