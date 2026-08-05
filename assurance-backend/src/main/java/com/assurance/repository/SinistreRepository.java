package com.assurance.repository;

import com.assurance.entity.Sinistre;
import com.assurance.enums.StatutSinistre;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface SinistreRepository extends JpaRepository<Sinistre, Long>, JpaSpecificationExecutor<Sinistre> {

    @EntityGraph(attributePaths = {
            "contrat",
            "client",
            "vehicule",
            "ville",
            "compagnieAssurance",
            "gestionnaire",
            "mouvementCouverture",
            "couverture"
    })
    Optional<Sinistre> findByIdAndAgenceId(Long id, Long agenceId);

    long countByAgenceIdAndStatutIn(Long agenceId, List<StatutSinistre> statuts);

    long countByAgenceIdAndDateDeclarationBetween(Long agenceId, LocalDate dateDu, LocalDate dateAu);

    List<Sinistre> findTop8ByAgenceIdOrderByUpdatedAtDesc(Long agenceId);

    boolean existsByAgenceIdAndNumeroSinistreIgnoreCase(Long agenceId, String numeroSinistre);
}
