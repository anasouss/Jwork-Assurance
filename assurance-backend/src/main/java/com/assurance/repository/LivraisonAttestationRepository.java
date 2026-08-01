package com.assurance.repository;

import com.assurance.entity.LivraisonAttestation;
import com.assurance.enums.SourceLivraisonAttestation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface LivraisonAttestationRepository extends JpaRepository<LivraisonAttestation, Long> {
    List<LivraisonAttestation> findByAgenceIdAndSourceAndActifTrueOrderByCreatedAtDesc(Long agenceId, SourceLivraisonAttestation source);
    Optional<LivraisonAttestation> findByIdAndAgenceIdAndActifTrue(Long id, Long agenceId);
}
