package com.assurance.repository;

import com.assurance.entity.ConditionPaiementClient;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface ConditionPaiementClientRepository extends JpaRepository<ConditionPaiementClient, Long> {

    List<ConditionPaiementClient> findByAgenceIdAndClientPayeurIdOrderByDateDebutDescIdDesc(
            Long agenceId,
            Long clientId
    );

    List<ConditionPaiementClient> findByAgenceIdAndGroupePayeurIdOrderByDateDebutDescIdDesc(
            Long agenceId,
            Long groupeId
    );

    Optional<ConditionPaiementClient> findByAgenceIdAndId(Long agenceId, Long id);

    @Query("""
            select condition
            from ConditionPaiementClient condition
            where condition.agence.id = :agenceId
              and condition.clientPayeur.id = :clientId
              and condition.dateDebut <= :referenceDate
              and (condition.dateFin is null or condition.dateFin >= :referenceDate)
            order by condition.dateDebut desc, condition.id desc
            """)
    List<ConditionPaiementClient> findEffectiveForClient(
            @Param("agenceId") Long agenceId,
            @Param("clientId") Long clientId,
            @Param("referenceDate") LocalDate referenceDate
    );

    @Query("""
            select condition
            from ConditionPaiementClient condition
            where condition.agence.id = :agenceId
              and condition.groupePayeur.id = :groupeId
              and condition.dateDebut <= :referenceDate
              and (condition.dateFin is null or condition.dateFin >= :referenceDate)
            order by condition.dateDebut desc, condition.id desc
            """)
    List<ConditionPaiementClient> findEffectiveForGroup(
            @Param("agenceId") Long agenceId,
            @Param("groupeId") Long groupeId,
            @Param("referenceDate") LocalDate referenceDate
    );
}
