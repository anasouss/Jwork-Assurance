package com.assurance.repository;

import com.assurance.entity.ElementFacturable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ElementFacturableRepository extends JpaRepository<ElementFacturable, Long> {
    List<ElementFacturable> findByAgenceIdOrderByCreatedAtDesc(Long agenceId);

    List<ElementFacturable> findByContratIdOrderByCreatedAtDesc(Long contratId);

    List<ElementFacturable> findByMouvementContratIdOrderByCreatedAtDesc(Long mouvementContratId);

    Optional<ElementFacturable> findFirstByMouvementContratIdOrderByCreatedAtAsc(Long mouvementContratId);
}
