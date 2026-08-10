package com.assurance.repository;

import com.assurance.entity.AffectationCompteTresorerie;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AffectationCompteTresorerieRepository
        extends JpaRepository<AffectationCompteTresorerie, Long> {

    @EntityGraph(attributePaths = {"utilisateur", "compteTresorerie"})
    List<AffectationCompteTresorerie> findByAgenceIdAndCompteTresorerieIdOrderByUtilisateurNomAscUtilisateurPrenomAsc(
            Long agenceId,
            Long compteId
    );

    Optional<AffectationCompteTresorerie> findByAgenceIdAndCompteTresorerieIdAndUtilisateurIdAndActifTrue(
            Long agenceId,
            Long compteId,
            Long utilisateurId
    );

    List<AffectationCompteTresorerie> findByAgenceIdAndUtilisateurIdAndActifTrue(
            Long agenceId,
            Long utilisateurId
    );

    Optional<AffectationCompteTresorerie> findByCompteTresorerieIdAndUtilisateurId(
            Long compteId,
            Long utilisateurId
    );
}
