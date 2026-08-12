package com.assurance.repository;

import com.assurance.entity.ImportReleveBancaire;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ImportReleveBancaireRepository extends JpaRepository<ImportReleveBancaire, Long> {

    @EntityGraph(attributePaths = {"compteTresorerie", "profilImport"})
    Page<ImportReleveBancaire> findByAgenceIdAndCompteTresorerieIdOrderByCreatedAtDesc(
            Long agenceId,
            Long compteTresorerieId,
            Pageable pageable
    );

    @EntityGraph(attributePaths = {"compteTresorerie", "profilImport"})
    Optional<ImportReleveBancaire> findByIdAndAgenceId(Long id, Long agenceId);

    boolean existsByAgenceIdAndCompteTresorerieIdAndSha256(
            Long agenceId,
            Long compteTresorerieId,
            String sha256
    );
}
