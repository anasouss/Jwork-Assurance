package com.assurance.repository;

import com.assurance.entity.AffectationReglementCompagnie;
import com.assurance.enums.StatutAffectationReglement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;

public interface AffectationReglementCompagnieRepository
        extends JpaRepository<AffectationReglementCompagnie, Long> {

    @Query("""
            select coalesce(sum(a.montant), 0)
            from AffectationReglementCompagnie a
            where a.bordereau.id = :bordereauId and a.statut = :statut
            """)
    BigDecimal sumByBordereauAndStatut(
            @Param("bordereauId") Long bordereauId,
            @Param("statut") StatutAffectationReglement statut
    );

    @Query("""
            select a.bordereau.id, a.statut, sum(a.montant)
            from AffectationReglementCompagnie a
            where a.bordereau.id in :bordereauIds
              and a.instrument.reglement.statut = com.assurance.enums.StatutReglementCompagnie.VALIDE
              and a.statut <> com.assurance.enums.StatutAffectationReglement.ANNULEE
            group by a.bordereau.id, a.statut
            """)
    List<Object[]> sumByBordereauIds(@Param("bordereauIds") Collection<Long> bordereauIds);

    @Query("""
            select a
            from AffectationReglementCompagnie a
            join fetch a.instrument i
            join fetch i.reglement r
            left join fetch i.compteTresorerie
            where a.bordereau.id = :bordereauId
              and r.statut = com.assurance.enums.StatutReglementCompagnie.VALIDE
              and a.statut <> com.assurance.enums.StatutAffectationReglement.ANNULEE
            order by i.dateInstrument desc, i.id desc
            """)
    List<AffectationReglementCompagnie> findActiveByBordereauId(
            @Param("bordereauId") Long bordereauId
    );
}
