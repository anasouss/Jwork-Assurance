package com.assurance.repository;

import com.assurance.entity.SequenceDocumentClient;
import com.assurance.enums.TypeDocumentClient;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface SequenceDocumentClientRepository extends JpaRepository<SequenceDocumentClient, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select s
            from SequenceDocumentClient s
            where s.agence.id = :agenceId
              and s.typeDocument = :type
              and s.annee = :annee
            """)
    Optional<SequenceDocumentClient> findForUpdate(
            @Param("agenceId") Long agenceId,
            @Param("type") TypeDocumentClient type,
            @Param("annee") Integer annee
    );
}
