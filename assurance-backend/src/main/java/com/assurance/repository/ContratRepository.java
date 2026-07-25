package com.assurance.repository;

import com.assurance.entity.Contrat;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ContratRepository extends JpaRepository<Contrat, String> {
    List<Contrat> findByAgenceIdOrderByCreatedAtDesc(String agenceId);

    @EntityGraph(attributePaths = {
            "agence",
            "compagnieAssurance",
            "convention"
    })
    Optional<Contrat> findByAgenceIdAndId(String agenceId, String id);

    boolean existsByAgenceIdAndNumeroContrat(String agenceId, String numeroContrat);
}
