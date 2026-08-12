package com.assurance.repository;

import com.assurance.entity.AcquisitionClient;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AcquisitionClientRepository extends JpaRepository<AcquisitionClient, Long> {
    @EntityGraph(attributePaths = {
            "origineCommerciale",
            "recommandeParUtilisateur",
            "recommandeParClient",
            "saisiPar",
            "modifiePar"
    })
    Optional<AcquisitionClient> findByAgenceIdAndClientId(Long agenceId, Long clientId);

    boolean existsByAgenceIdAndOrigineCommercialeId(Long agenceId, Long origineCommercialeId);
}
