package com.assurance.repository;

import com.assurance.entity.Quittance;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface QuittanceRepository extends JpaRepository<Quittance, String> {
    List<Quittance> findByContratIdOrderByCreatedAtDesc(String contratId);

    List<Quittance> findByContrat_IdAndElementFacturable_IdOrderByCreatedAtDesc(String contratId, String elementFacturableId);
}
