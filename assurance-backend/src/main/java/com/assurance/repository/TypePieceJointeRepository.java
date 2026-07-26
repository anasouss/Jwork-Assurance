package com.assurance.repository;

import com.assurance.entity.TypePieceJointe;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TypePieceJointeRepository extends JpaRepository<TypePieceJointe, Long> {
    List<TypePieceJointe> findByActifTrueOrderByLibelleAsc();

    List<TypePieceJointe> findByAgenceIdOrAgenceIsNullOrderByLibelleAsc(Long agenceId);
}
