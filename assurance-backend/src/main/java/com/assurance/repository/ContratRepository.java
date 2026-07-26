package com.assurance.repository;

import com.assurance.entity.Contrat;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ContratRepository extends JpaRepository<Contrat, Long> {
    List<Contrat> findByAgenceIdOrderByCreatedAtDesc(Long agenceId);

    @EntityGraph(attributePaths = {
            "agence",
            "compagnieAssurance",
            "convention"
    })
    Optional<Contrat> findByAgenceIdAndId(Long agenceId, Long id);

    boolean existsByAgenceIdAndNumeroContrat(Long agenceId, String numeroContrat);
}
