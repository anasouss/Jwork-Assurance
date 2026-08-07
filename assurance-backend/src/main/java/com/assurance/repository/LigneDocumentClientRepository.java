package com.assurance.repository;

import com.assurance.entity.LigneDocumentClient;
import com.assurance.enums.StatutDocumentClient;
import com.assurance.enums.TypeDocumentClient;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface LigneDocumentClientRepository extends JpaRepository<LigneDocumentClient, Long> {

    @Query("""
            select count(l)
            from LigneDocumentClient l
            where l.elementFacturable.mouvementContrat.id = :mouvementId
            """)
    long countByMouvementContratId(@Param("mouvementId") Long mouvementId);

    @Query("""
            select directElement.id
            from LigneDocumentClient l
            join l.elementFacturable directElement
            where directElement.id in :elementIds
              and l.document.typeDocument = :type
              and l.document.statut = :statut
            """)
    List<Long> findElementFacturableIdsAlreadyIssued(
            @Param("elementIds") Collection<Long> elementIds,
            @Param("type") TypeDocumentClient type,
            @Param("statut") StatutDocumentClient statut
    );

    List<LigneDocumentClient> findByEcheanceFacturationConventionIdIn(Collection<Long> echeanceIds);
}
