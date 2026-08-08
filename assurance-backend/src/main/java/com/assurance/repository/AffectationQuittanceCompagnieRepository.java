package com.assurance.repository;

import com.assurance.entity.AffectationQuittanceCompagnie;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;
import java.time.LocalDate;

import java.util.Collection;
import java.util.List;

public interface AffectationQuittanceCompagnieRepository extends JpaRepository<AffectationQuittanceCompagnie, Long> {

    @EntityGraph(attributePaths = {"compagnieAssurance"})
    List<AffectationQuittanceCompagnie> findByQuittanceIdOrderByDateEffetAscNumeroQuittanceCompagnieAsc(Long quittanceId);

    @EntityGraph(attributePaths = {"compagnieAssurance"})
    List<AffectationQuittanceCompagnie> findByQuittanceIdIn(Collection<Long> quittanceIds);

    void deleteByQuittanceId(Long quittanceId);

    boolean existsByQuittanceId(Long quittanceId);

    boolean existsByAgenceIdAndCompagnieAssuranceIdAndNumeroQuittanceCompagnieIgnoreCaseAndQuittanceIdNot(
            Long agenceId,
            Long compagnieId,
            String numeroQuittanceCompagnie,
            Long quittanceId
    );

    boolean existsByAgenceIdAndCompagnieAssuranceIdAndNumeroQuittanceCompagnieIgnoreCaseAndQuittanceIdNotIn(
            Long agenceId,
            Long compagnieId,
            String numeroQuittanceCompagnie,
            Collection<Long> quittanceIds
    );

    @EntityGraph(attributePaths = {
            "compagnieAssurance",
            "quittance",
            "quittance.contrat",
            "quittance.mouvementContrat",
            "quittance.elementFacturable"
    })
    @Query("""
            select a
            from AffectationQuittanceCompagnie a
            where a.agence.id = :agenceId
              and (:compagnieId is null or a.compagnieAssurance.id = :compagnieId)
              and (:dateDu is null or a.dateEffet >= :dateDu)
              and (:dateAu is null or a.dateEffet <= :dateAu)
              and not exists (
                    select l.id
                    from LigneBordereauCompagnie l
                    where l.affectationReservee = a
              )
            order by a.dateEffet asc, a.numeroQuittanceCompagnie asc
            """)
    List<AffectationQuittanceCompagnie> findEligible(
            @Param("agenceId") Long agenceId,
            @Param("compagnieId") Long compagnieId,
            @Param("dateDu") LocalDate dateDu,
            @Param("dateAu") LocalDate dateAu
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {
            "compagnieAssurance",
            "quittance",
            "quittance.contrat",
            "quittance.mouvementContrat",
            "quittance.elementFacturable"
    })
    @Query("""
            select a
            from AffectationQuittanceCompagnie a
            where a.agence.id = :agenceId and a.id in :ids
            order by a.dateEffet asc, a.id asc
            """)
    List<AffectationQuittanceCompagnie> lockByAgenceIdAndIdIn(
            @Param("agenceId") Long agenceId,
            @Param("ids") Collection<Long> ids
    );
}
