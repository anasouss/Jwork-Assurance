package com.assurance.repository;

import com.assurance.entity.MouvementContrat;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MouvementContratRepository extends JpaRepository<MouvementContrat, Long> {
    List<MouvementContrat> findByContratIdOrderByCreatedAtDesc(Long contratId);
}
