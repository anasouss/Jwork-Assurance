package com.assurance.repository;

import com.assurance.entity.RapprochementBancaire;
import com.assurance.enums.StatutRapprochementBancaire;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;

public interface RapprochementBancaireRepository extends JpaRepository<RapprochementBancaire, Long> {

    @EntityGraph(attributePaths = {
            "ligneReleve",
            "ligneReleve.importReleve",
            "ligneReleve.importReleve.compteTresorerie",
            "instrumentReglement",
            "instrumentReglement.reglement"
    })
    List<RapprochementBancaire> findByInstrumentReglementIdAndStatutIn(
            Long instrumentId,
            Collection<StatutRapprochementBancaire> statuts
    );

    @Query("""
            select coalesce(sum(r.montant), 0)
            from RapprochementBancaire r
            where r.instrumentReglement.id = :instrumentId
              and r.statut in :statuts
            """)
    BigDecimal sumByInstrumentAndStatuses(
            @Param("instrumentId") Long instrumentId,
            @Param("statuts") Collection<StatutRapprochementBancaire> statuts
    );

    void deleteByLigneReleveImportReleveIdAndStatut(
            Long importId,
            StatutRapprochementBancaire statut
    );

    List<RapprochementBancaire> findByLigneReleveImportReleveIdAndStatutOrderByIdAsc(
            Long importId,
            StatutRapprochementBancaire statut
    );
}
