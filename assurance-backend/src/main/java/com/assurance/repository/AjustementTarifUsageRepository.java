package com.assurance.repository;

import com.assurance.entity.AjustementTarifUsage;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AjustementTarifUsageRepository extends JpaRepository<AjustementTarifUsage, Long> {
    Page<AjustementTarifUsage> findAllByOrderByCreatedAtDescIdDesc(Pageable pageable);
}
