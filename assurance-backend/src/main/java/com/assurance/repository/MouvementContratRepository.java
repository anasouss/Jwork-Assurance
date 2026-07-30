package com.assurance.repository;

import com.assurance.entity.MouvementContrat;
import com.assurance.enums.StatutMouvementContrat;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface MouvementContratRepository extends JpaRepository<MouvementContrat, Long> {
    long countByAgenceIdAndStatutAndDateEffetBetween(
            Long agenceId,
            StatutMouvementContrat statut,
            LocalDate dateDu,
            LocalDate dateAu
    );

    @EntityGraph(attributePaths = {"typeMouvement", "contrat", "contrat.compagnieAssurance"})
    Page<MouvementContrat> findByAgenceIdAndStatutOrderByCreatedAtDesc(
            Long agenceId,
            StatutMouvementContrat statut,
            Pageable pageable
    );

    List<MouvementContrat> findByContratIdOrderByCreatedAtDesc(Long contratId);

    @EntityGraph(attributePaths = "typeMouvement")
    List<MouvementContrat> findByContratIdInOrderByCreatedAtDesc(List<Long> contratIds);

    Optional<MouvementContrat> findByContratIdAndId(Long contratId, Long id);

    Optional<MouvementContrat> findFirstByContratIdOrderByCreatedAtDesc(Long contratId);
}
