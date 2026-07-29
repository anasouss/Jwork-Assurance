package com.assurance.repository;

import com.assurance.entity.Quittance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;

import java.util.List;
import java.util.Optional;

public interface QuittanceRepository extends JpaRepository<Quittance, Long> {
    List<Quittance> findByContratIdOrderByCreatedAtDesc(Long contratId);

    List<Quittance> findByContrat_IdAndElementFacturable_IdOrderByCreatedAtDesc(Long contratId, Long elementFacturableId);

    List<Quittance> findByMouvementContratIdOrderByCreatedAtDesc(Long mouvementContratId);

    Optional<Quittance> findFirstByMouvementContratIdOrderByCreatedAtAsc(Long mouvementContratId);

    Optional<Quittance> findFirstByContratIdAndGlobaleTrueOrderByCreatedAtDesc(Long contratId);

    @EntityGraph(attributePaths = {"mouvementContrat", "elementFacturable"})
    List<Quittance> findByContratIdAndGlobaleTrueOrderByCreatedAtAsc(Long contratId);
}
