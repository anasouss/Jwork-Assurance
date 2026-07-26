package com.assurance.repository;

import com.assurance.entity.LivraisonAttestation;
import com.assurance.enums.SourceLivraisonAttestation;
import com.assurance.enums.StatutLivraisonAttestation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface LivraisonAttestationRepository extends JpaRepository<LivraisonAttestation, Long> {
    List<LivraisonAttestation> findByAgenceIdAndSourceAndActifTrueOrderByCreatedAtDesc(Long agenceId, SourceLivraisonAttestation source);
    List<LivraisonAttestation> findByStatutAndActifTrue(StatutLivraisonAttestation statut);
}
