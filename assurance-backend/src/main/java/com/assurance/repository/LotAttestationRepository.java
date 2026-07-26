package com.assurance.repository;

import com.assurance.entity.LivraisonAttestation;
import com.assurance.entity.LotAttestation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface LotAttestationRepository extends JpaRepository<LotAttestation, Long> {
    List<LotAttestation> findByLivraisonAndActifTrue(LivraisonAttestation livraison);

    @Query("select coalesce(sum(l.quantite), 0) from LotAttestation l where l.livraison = :livraison and l.actif = true")
    int sumQuantiteByLivraison(@Param("livraison") LivraisonAttestation livraison);
}
