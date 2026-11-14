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

    List<EcheanceFacturationConvention> findByContratIdOrderByNumeroPeriodeAsc(Long contratId);

    @EntityGraph(attributePaths = {"contrat", "contrat.convention", "contrat.payeurPrime", "contrat.groupeFacturation"})
    @Query("""
            select e from EcheanceFacturationConvention e
            where e.agence.id = :agenceId
              and e.contrat.agence.id = :agenceId
              and e.contrat.convention.agence.id = :agenceId
              and e.contrat.convention.id = :conventionId
              and e.actif = true
              and e.statut = com.assurance.enums.StatutEcheanceFacturationConvention.A_FACTURER
              and e.documentClient is null
              and e.periodeDebut = :debut and e.periodeFin = :fin
            order by e.id
            """)
    List<EcheanceFacturationConvention> findPendingPeriod(
            @Param("agenceId") Long agenceId,
            @Param("conventionId") Long conventionId,
            @Param("debut") java.time.LocalDate debut,
            @Param("fin") java.time.LocalDate fin
    );

    @org.springframework.data.jpa.repository.Modifying
    @Query("""
            update EcheanceFacturationConvention e set e.actif = false
            where e.agence.id = :agenceId and e.statut = com.assurance.enums.StatutEcheanceFacturationConvention.A_FACTURER
              and e.mouvement.id in (select m.id from MouvementContrat m
                  where m.agence.id = :agenceId and m.statut <> com.assurance.enums.StatutMouvementContrat.VALIDE)
            """)
    void deactivateCancelledMovementSchedules(@Param("agenceId") Long agenceId);

    List<EcheanceFacturationConvention> findByAgenceIdAndDocumentClientId(Long agenceId, Long documentClientId);

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
              and e.contrat.agence.id = :agenceId
              and e.contrat.convention.agence.id = :agenceId
              and e.id in :ids
            order by e.periodeDebut, e.id
            """)
    List<EcheanceFacturationConvention> findSelected(
            @Param("agenceId") Long agenceId,
            @Param("ids") List<Long> ids
    );

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
              and e.contrat.agence.id = :agenceId
              and e.contrat.convention.agence.id = :agenceId
              and e.id in :ids
            order by e.periodeDebut, e.id
            """)
    List<EcheanceFacturationConvention> findForUpdate(
            @Param("agenceId") Long agenceId,
            @Param("ids") List<Long> ids
    );
}
