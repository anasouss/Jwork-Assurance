package com.assurance.repository;

import com.assurance.entity.EcheanceFacturationConvention;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface EcheanceFacturationConventionRepository
        extends JpaRepository<EcheanceFacturationConvention, Long> {

    @EntityGraph(attributePaths = {
            "contrat",
            "contrat.compagnieAssurance",
            "contrat.convention",
            "contrat.payeurPrime",
            "contrat.groupeFacturation",
            "documentClient"
    })
    List<EcheanceFacturationConvention> findByAgenceIdAndActifTrueOrderByDateEcheanceAscIdAsc(Long agenceId);

    List<EcheanceFacturationConvention> findByContratIdAndActifTrueOrderByNumeroPeriodeAsc(Long contratId);

    List<EcheanceFacturationConvention> findByDocumentClientId(Long documentClientId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {
            "contrat",
            "contrat.compagnieAssurance",
            "contrat.convention",
            "contrat.payeurPrime",
            "contrat.groupeFacturation"
    })
    @Query("""
            select e
            from EcheanceFacturationConvention e
            where e.agence.id = :agenceId
              and e.id in :ids
            order by e.periodeDebut, e.id
            """)
    List<EcheanceFacturationConvention> findForUpdate(
            @Param("agenceId") Long agenceId,
            @Param("ids") List<Long> ids
    );
}
