package com.assurance.repository;

import com.assurance.entity.Quittance;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface QuittanceRepository extends JpaRepository<Quittance, Long> {
    List<Quittance> findByContratIdOrderByCreatedAtDesc(Long contratId);

    List<Quittance> findByContrat_IdAndElementFacturable_IdOrderByCreatedAtDesc(Long contratId, Long elementFacturableId);

    Optional<Quittance> findFirstByMouvementContratIdOrderByCreatedAtAsc(Long mouvementContratId);
}
