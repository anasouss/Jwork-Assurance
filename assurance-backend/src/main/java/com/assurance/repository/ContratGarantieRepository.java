package com.assurance.repository;

import com.assurance.entity.ContratGarantie;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ContratGarantieRepository extends JpaRepository<ContratGarantie, Long> {
    void deleteByContratId(Long contratId);
}
