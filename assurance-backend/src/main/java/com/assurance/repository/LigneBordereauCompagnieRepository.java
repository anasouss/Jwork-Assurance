package com.assurance.repository;

import com.assurance.entity.LigneBordereauCompagnie;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface LigneBordereauCompagnieRepository extends JpaRepository<LigneBordereauCompagnie, Long> {
    boolean existsByAffectationReserveeId(Long affectationId);
    boolean existsByAffectationReserveeIdIn(Collection<Long> affectationIds);

    @Query("""
            select l
            from LigneBordereauCompagnie l
            join fetch l.bordereau b
            where l.affectationReservee.id in :affectationIds
              and b.statut <> com.assurance.enums.StatutBordereauCompagnie.ANNULE
            """)
    List<LigneBordereauCompagnie> findActiveByAffectationIds(
            @Param("affectationIds") Collection<Long> affectationIds
    );
}
