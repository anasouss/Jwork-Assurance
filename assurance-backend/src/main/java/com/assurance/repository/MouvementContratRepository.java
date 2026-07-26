package com.assurance.repository;

import com.assurance.entity.MouvementContrat;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MouvementContratRepository extends JpaRepository<MouvementContrat, Long> {
    List<MouvementContrat> findByContratIdOrderByCreatedAtDesc(Long contratId);

    Optional<MouvementContrat> findByContratIdAndId(Long contratId, Long id);

    Optional<MouvementContrat> findFirstByContratIdOrderByCreatedAtDesc(Long contratId);
}
