package com.assurance.repository;

import com.assurance.entity.EcartReglementClient;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface EcartReglementClientRepository extends JpaRepository<EcartReglementClient, Long> {
    @Query("""
            select e.elementFacturable.id, sum(e.montant)
            from EcartReglementClient e
            where e.agence.id = :agenceId and e.elementFacturable.id in :ids
              and e.reglement.statut = com.assurance.enums.StatutReglementClient.VALIDE
            group by e.elementFacturable.id
            """)
    List<Object[]> sumByElementIds(@Param("agenceId") Long agenceId, @Param("ids") Collection<Long> ids);

    @Query("""
            select d.id, sum(e.montant)
            from EcartReglementClient e, DocumentClient d
            where e.agence.id = :agenceId and d.agence.id = :agenceId
              and d.id in :ids
              and exists (select 1 from LigneDocumentClient l where l.document = d and l.elementFacturable = e.elementFacturable)
              and e.reglement.statut = com.assurance.enums.StatutReglementClient.VALIDE
            group by d.id
            """)
    List<Object[]> sumByDocumentIds(@Param("agenceId") Long agenceId, @Param("ids") Collection<Long> ids);
}
