package com.assurance.repository;

import com.assurance.entity.LigneTarificationAssistance;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LigneTarificationAssistanceRepository extends JpaRepository<LigneTarificationAssistance, Long> {
    void deleteByAssistanceContratId(Long assistanceContratId);
}
