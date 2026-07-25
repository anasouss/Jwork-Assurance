package com.assurance.repository;

import com.assurance.entity.LigneQuittance;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface LigneQuittanceRepository extends JpaRepository<LigneQuittance, String> {
    List<LigneQuittance> findByQuittanceIdOrderByOrdreAsc(String quittanceId);

    List<LigneQuittance> findByQuittance_ElementFacturable_IdOrderByOrdreAsc(String elementFacturableId);
}
