package com.assurance.repository;

import com.assurance.entity.LigneQuittance;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface LigneQuittanceRepository extends JpaRepository<LigneQuittance, Long> {
    List<LigneQuittance> findByQuittanceIdOrderByOrdreAsc(Long quittanceId);

    List<LigneQuittance> findByQuittance_ElementFacturable_IdOrderByOrdreAsc(Long elementFacturableId);
}
