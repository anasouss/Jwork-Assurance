package com.assurance.repository;

import com.assurance.entity.DocumentUsage;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface DocumentUsageRepository extends JpaRepository<DocumentUsage, Long> {
    List<DocumentUsage> findByContratAgenceIdAndContratIdAndMouvementId(Long agenceId, Long contratId, Long mouvementId);
    boolean existsByPieceId(Long pieceId);
    boolean existsByPieceIdAndContratIdAndContratAgenceId(Long pieceId, Long contratId, Long agenceId);
    boolean existsByPieceIdAndMouvementIdAndTypeId(Long pieceId, Long mouvementId, Long typeId);
}
