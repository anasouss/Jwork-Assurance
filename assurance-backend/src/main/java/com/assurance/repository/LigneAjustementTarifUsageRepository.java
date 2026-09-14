package com.assurance.repository;

import com.assurance.entity.LigneAjustementTarifUsage;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

public interface LigneAjustementTarifUsageRepository extends JpaRepository<LigneAjustementTarifUsage, Long> {

    boolean existsByTarifUsageId(Long tarifUsageId);

    @EntityGraph(attributePaths = {
            "tarifUsage",
            "tarifUsage.usage",
            "tarifUsage.categorieTransport",
            "tarifUsage.carburant",
            "tarifUsage.sousClasse"
    })
    List<LigneAjustementTarifUsage> findByAjustementIdOrderByTarifUsageIdAsc(Long ajustementId);

    @Query("""
            select ligne
            from LigneAjustementTarifUsage ligne
            join fetch ligne.ajustement ajustement
            where ligne.tarifUsage.id = :tarifId
              and ajustement.dateDebut <= :dateReference
              and (ajustement.dateFin is null or ajustement.dateFin >= :dateReference)
            order by ajustement.createdAt desc, ajustement.id desc
            """)
    List<LigneAjustementTarifUsage> findApplicable(
            @Param("tarifId") Long tarifId,
            @Param("dateReference") LocalDate dateReference,
            Pageable pageable
    );

    @Query("""
            select ligne
            from LigneAjustementTarifUsage ligne
            join fetch ligne.ajustement ajustement
            where ligne.tarifUsage.id in :tarifIds
              and ajustement.dateDebut <= :dateReference
              and (ajustement.dateFin is null or ajustement.dateFin >= :dateReference)
            order by ajustement.createdAt desc, ajustement.id desc
            """)
    List<LigneAjustementTarifUsage> findApplicable(
            @Param("tarifIds") Collection<Long> tarifIds,
            @Param("dateReference") LocalDate dateReference
    );
}
