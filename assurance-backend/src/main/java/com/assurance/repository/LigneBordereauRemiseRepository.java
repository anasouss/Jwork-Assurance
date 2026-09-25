package com.assurance.repository;

import com.assurance.entity.LigneBordereauRemise;
import com.assurance.enums.StatutBordereauRemise;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface LigneBordereauRemiseRepository extends JpaRepository<LigneBordereauRemise, Long> {

    @Query("""
            select (count(l) > 0)
            from LigneBordereauRemise l
            where l.instrument.id in :instrumentIds
              and l.bordereau.statut in :statuts
            """)
    boolean existsActiveByInstrumentIds(
            @Param("instrumentIds") Collection<Long> instrumentIds,
            @Param("statuts") Collection<StatutBordereauRemise> statuts
    );

    @EntityGraph(attributePaths = {"bordereau", "instrument"})
    @Query("""
            select l
            from LigneBordereauRemise l
            where l.instrument.id = :instrumentId
              and l.bordereau.statut in :statuts
            order by l.id desc
            """)
    List<LigneBordereauRemise> findActiveByInstrumentId(
            @Param("instrumentId") Long instrumentId,
            @Param("statuts") Collection<StatutBordereauRemise> statuts
    );

    @EntityGraph(attributePaths = {"bordereau", "instrument"})
    @Query("""
            select l
            from LigneBordereauRemise l
            where l.instrument.id = :instrumentId
              and l.bordereau.statut <> com.assurance.enums.StatutBordereauRemise.ANNULE
              and l.statut <> com.assurance.enums.StatutLigneBordereauRemise.PREPAREE
            order by l.id desc
            """)
    List<LigneBordereauRemise> findHistoryByInstrumentId(
            @Param("instrumentId") Long instrumentId
    );

    @EntityGraph(attributePaths = {"bordereau", "instrument", "instrument.reglement"})
    Optional<LigneBordereauRemise> findByIdAndBordereauId(Long id, Long bordereauId);
}
