package com.assurance.repository;

import com.assurance.entity.LigneReleveBancaire;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface LigneReleveBancaireRepository extends JpaRepository<LigneReleveBancaire, Long> {

    @EntityGraph(attributePaths = {
            "importReleve",
            "importReleve.compteTresorerie",
            "rapprochements",
            "rapprochements.instrumentReglement",
            "rapprochements.instrumentReglement.reglement"
    })
    Optional<LigneReleveBancaire> findByIdAndImportReleveAgenceId(Long id, Long agenceId);

    @EntityGraph(attributePaths = {
            "rapprochements",
            "rapprochements.instrumentReglement",
            "rapprochements.instrumentReglement.reglement"
    })
    List<LigneReleveBancaire> findByImportReleveIdOrderByNumeroLigneAsc(Long importId);

    void deleteByImportReleveId(Long importId);
}
