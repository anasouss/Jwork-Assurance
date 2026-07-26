package com.assurance.repository;

import com.assurance.entity.CapitalResponsabiliteCivile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CapitalResponsabiliteCivileRepository extends JpaRepository<CapitalResponsabiliteCivile, Long> {
    Optional<CapitalResponsabiliteCivile> findByUsageCodeIgnoreCaseAndActifTrue(String usageCode);
}
