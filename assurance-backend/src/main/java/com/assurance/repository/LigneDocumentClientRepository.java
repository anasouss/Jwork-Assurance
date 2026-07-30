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
            select l.quittance.id
            from LigneDocumentClient l
            where l.quittance.id in :quittanceIds
              and l.document.typeDocument = :type
              and l.document.statut = :statut
            """)
    List<Long> findQuittanceIdsAlreadyIssued(
            @Param("quittanceIds") Collection<Long> quittanceIds,
            @Param("type") TypeDocumentClient type,
            @Param("statut") StatutDocumentClient statut
    );
}
