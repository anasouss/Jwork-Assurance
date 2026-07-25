package com.assurance.repository;

import com.assurance.entity.TarifUsage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TarifUsageRepository extends JpaRepository<TarifUsage, String> {
    List<TarifUsage> findByUsage_IdAndActifTrue(String usageId);
}
