package com.assurance.repository;

import com.assurance.entity.NaturePieceJointe;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface NaturePieceJointeRepository extends JpaRepository<NaturePieceJointe, Long> {
    Optional<NaturePieceJointe> findByAgenceIdAndCleNormalisee(Long agenceId, String cleNormalisee);

    Optional<NaturePieceJointe> findByAgenceIsNullAndCleNormalisee(String cleNormalisee);
}
