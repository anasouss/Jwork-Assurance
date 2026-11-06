package com.assurance.repository;

import com.assurance.entity.LigneTarificationAssistance;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface LigneTarificationAssistanceRepository extends JpaRepository<LigneTarificationAssistance, Long> {
    void deleteByAssistanceContratId(Long assistanceContratId);

    List<LigneTarificationAssistance> findByAssistanceContratContratIdAndAssistanceContratContratAgenceIdOrderByIdAsc(Long contratId, Long agenceId);
}
