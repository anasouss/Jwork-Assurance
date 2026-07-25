package com.assurance.repository;

import com.assurance.entity.MouvementContrat;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MouvementContratRepository extends JpaRepository<MouvementContrat, String> {
    List<MouvementContrat> findByContratIdOrderByCreatedAtDesc(String contratId);
}
