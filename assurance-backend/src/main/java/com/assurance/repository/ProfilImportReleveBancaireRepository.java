package com.assurance.repository;

import com.assurance.entity.ProfilImportReleveBancaire;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ProfilImportReleveBancaireRepository
        extends JpaRepository<ProfilImportReleveBancaire, Long> {

    @EntityGraph(attributePaths = "compteTresorerie")
    List<ProfilImportReleveBancaire> findByAgenceIdAndCompteTresorerieIdAndActifTrueOrderByNomAsc(
            Long agenceId,
            Long compteTresorerieId
    );

    Optional<ProfilImportReleveBancaire> findByIdAndAgenceIdAndCompteTresorerieId(
            Long id,
            Long agenceId,
            Long compteTresorerieId
    );

    Optional<ProfilImportReleveBancaire> findByAgenceIdAndCompteTresorerieIdAndNomIgnoreCase(
            Long agenceId,
            Long compteTresorerieId,
            String nom
    );
}
