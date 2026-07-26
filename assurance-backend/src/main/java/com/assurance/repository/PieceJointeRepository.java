package com.assurance.repository;

import com.assurance.entity.PieceJointe;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PieceJointeRepository extends JpaRepository<PieceJointe, Long> {
    List<PieceJointe> findByContratIdOrderByCreatedAtDesc(Long contratId);
}
