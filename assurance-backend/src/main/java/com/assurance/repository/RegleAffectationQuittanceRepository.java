package com.assurance.repository;

import com.assurance.entity.RegleAffectationQuittance;
import com.assurance.enums.TypeContrat;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface RegleAffectationQuittanceRepository extends JpaRepository<RegleAffectationQuittance, Long> {

    @EntityGraph(attributePaths = {"compagnieAssurance"})
    Page<RegleAffectationQuittance> findByAgenceIdOrderByCompagnieAssuranceNomAscTypeContratAscDateDebutDesc(
            Long agenceId,
            Pageable pageable
    );

    @EntityGraph(attributePaths = {"compagnieAssurance"})
    List<RegleAffectationQuittance> findAllByAgenceIdOrderByCompagnieAssuranceNomAscTypeContratAscDateDebutDesc(
            Long agenceId
    );

    @EntityGraph(attributePaths = {"compagnieAssurance", "agence"})
    Optional<RegleAffectationQuittance> findByAgenceIdAndId(Long agenceId, Long id);

    @EntityGraph(attributePaths = {"compagnieAssurance", "agence"})
    @Query("""
            select r
            from RegleAffectationQuittance r
            where r.agence.id = :agenceId
              and r.compagnieAssurance.id = :compagnieId
              and r.typeContrat = :typeContrat
              and r.actif = true
              and r.dateDebut <= :dateEffet
              and (r.dateFin is null or r.dateFin >= :dateEffet)
            order by r.dateDebut desc
            """)
    List<RegleAffectationQuittance> findEffectiveRules(
            @Param("agenceId") Long agenceId,
            @Param("compagnieId") Long compagnieId,
            @Param("typeContrat") TypeContrat typeContrat,
            @Param("dateEffet") LocalDate dateEffet
    );

    @Query("""
            select count(r)
            from RegleAffectationQuittance r
            where r.agence.id = :agenceId
              and r.compagnieAssurance.id = :compagnieId
              and r.typeContrat = :typeContrat
              and r.id <> :excludedId
              and r.actif = true
              and r.dateDebut <= :dateFin
              and (r.dateFin is null or r.dateFin >= :dateDebut)
            """)
    long countOverlappingRules(
            @Param("agenceId") Long agenceId,
            @Param("compagnieId") Long compagnieId,
            @Param("typeContrat") TypeContrat typeContrat,
            @Param("dateDebut") LocalDate dateDebut,
            @Param("dateFin") LocalDate dateFin,
            @Param("excludedId") Long excludedId
    );

    @Query("""
            select count(a)
            from AffectationQuittanceCompagnie a
            join a.quittance q
            join q.contrat c
            where a.agence.id = :agenceId
              and a.compagnieAssurance.id = :compagnieId
              and c.typeContrat = :typeContrat
              and q.dateDebut >= :dateDebut
              and q.dateDebut <= :dateFin
            """)
    long countAllocationsUsingRule(
            @Param("agenceId") Long agenceId,
            @Param("compagnieId") Long compagnieId,
            @Param("typeContrat") TypeContrat typeContrat,
            @Param("dateDebut") LocalDate dateDebut,
            @Param("dateFin") LocalDate dateFin
    );
}
