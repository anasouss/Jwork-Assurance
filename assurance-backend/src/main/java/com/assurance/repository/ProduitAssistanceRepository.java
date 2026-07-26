package com.assurance.repository;

import com.assurance.entity.ProduitAssistance;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProduitAssistanceRepository extends JpaRepository<ProduitAssistance, Long> {
    List<ProduitAssistance> findByCompagnieAssistanceIdAndActifTrueOrderByLibelleAsc(Long compagnieAssistanceId);
}
