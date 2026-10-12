package com.assurance.repository;

import com.assurance.entity.AffectationCompteTresorerie;
import com.assurance.enums.NatureCaisseTresorerie;
import com.assurance.enums.TypeCompteTresorerie;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

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

    @Query("""
            select a
            from AffectationCompteTresorerie a
            join fetch a.utilisateur u
            join fetch a.compteTresorerie c
            where u.id = :utilisateurId
              and c.typeCompte = :typeCompte
              and c.natureCaisse = :natureCaisse
            """)
    List<AffectationCompteTresorerie> findByUserAndCashNature(
            @Param("utilisateurId") Long utilisateurId,
            @Param("typeCompte") TypeCompteTresorerie typeCompte,
            @Param("natureCaisse") NatureCaisseTresorerie natureCaisse
    );

    Optional<AffectationCompteTresorerie> findByCompteTresorerieIdAndUtilisateurId(
            Long compteId,
            Long utilisateurId
    );
}
