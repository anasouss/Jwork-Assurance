package com.assurance.repository;

import com.assurance.entity.LigneLivraisonAttestation;
import com.assurance.entity.LivraisonAttestation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface LigneLivraisonAttestationRepository extends JpaRepository<LigneLivraisonAttestation, Long> {
    List<LigneLivraisonAttestation> findByLivraisonAndActifTrue(LivraisonAttestation livraison);
    Optional<LigneLivraisonAttestation> findByLivraisonAndGroupeUsageAttestationIdAndActifTrue(LivraisonAttestation livraison, Long groupeUsageAttestationId);
}
