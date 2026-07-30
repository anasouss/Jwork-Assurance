package com.assurance.repository;

import com.assurance.entity.LigneQuittance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface LigneQuittanceRepository extends JpaRepository<LigneQuittance, Long> {
    @Query("""
            select l.categorie, coalesce(sum(l.primeTotale), 0)
            from LigneQuittance l
            left join l.quittance.mouvementContrat m
            where l.quittance.contrat.agence.id = :agenceId
              and l.globale = false
              and l.quittance.globale = true
              and l.quittance.alternative = false
              and l.quittance.contrat.prospection = false
              and (m is null or m.statut = com.assurance.enums.StatutMouvementContrat.VALIDE)
              and (l.quittance.elementFacturable is null or l.quittance.elementFacturable.statut <> com.assurance.enums.StatutElementFacturable.ANNULE)
              and l.quittance.dateDebut between :dateDu and :dateAu
            group by l.categorie
            order by l.categorie
            """)
    List<Object[]> sumDashboardByCategory(
            @Param("agenceId") Long agenceId,
            @Param("dateDu") LocalDate dateDu,
            @Param("dateAu") LocalDate dateAu
    );

    List<LigneQuittance> findByQuittanceIdOrderByOrdreAsc(Long quittanceId);

    List<LigneQuittance> findByQuittance_ElementFacturable_IdOrderByOrdreAsc(Long elementFacturableId);

    void deleteByQuittanceId(Long quittanceId);
}
