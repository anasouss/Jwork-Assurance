package com.assurance.repository;

import com.assurance.entity.ClientPortalAccess;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.Optional;

public interface ClientPortalAccessRepository extends JpaRepository<ClientPortalAccess, Long> {
    String SCOPE = " a.account.id = :account and a.account.agence.id = :agency and a.actif = true ";
    String CONTRACT = " a.contrat is not null and a.contrat.agence.id = :agency and a.contrat.brouillon = false and a.contrat.prospection = false ";
    String CLAIM = " a.sinistre is not null and a.sinistre.agence.id = :agency and a.sinistre.statut <> com.assurance.enums.StatutSinistre.BROUILLON ";

    @EntityGraph(attributePaths = {"contrat", "sinistre", "sinistre.contrat"})
    @Query("select a from ClientPortalAccess a where a.account.id = :account and a.account.agence.id = :agency order by a.id desc")
    Page<ClientPortalAccess> findForStaff(@Param("agency") Long agency, @Param("account") Long account, Pageable pageable);

    @Query("select a from ClientPortalAccess a where a.id = :id and a.account.agence.id = :agency")
    Optional<ClientPortalAccess> findForStaff(@Param("agency") Long agency, @Param("id") Long id);

    @Query("select a from ClientPortalAccess a where a.account.id = :account and a.account.agence.id = :agency and a.contrat.id = :target")
    Optional<ClientPortalAccess> findContractGrant(@Param("agency") Long agency, @Param("account") Long account, @Param("target") Long target);

    @Query("select a from ClientPortalAccess a where a.account.id = :account and a.account.agence.id = :agency and a.sinistre.id = :target")
    Optional<ClientPortalAccess> findClaimGrant(@Param("agency") Long agency, @Param("account") Long account, @Param("target") Long target);

    @EntityGraph(attributePaths = {"contrat", "contrat.compagnieAssurance"})
    @Query("select a from ClientPortalAccess a where " + SCOPE + " and " + CONTRACT + " order by a.id desc")
    Page<ClientPortalAccess> contracts(@Param("agency") Long agency, @Param("account") Long account, Pageable pageable);

    @EntityGraph(attributePaths = {"sinistre", "sinistre.contrat"})
    @Query("select a from ClientPortalAccess a where " + SCOPE + " and " + CLAIM + " order by a.id desc")
    Page<ClientPortalAccess> claims(@Param("agency") Long agency, @Param("account") Long account, Pageable pageable);

    @Query("select a from ClientPortalAccess a where " + SCOPE + " and " + CONTRACT + " and a.contrat.id = :target")
    Optional<ClientPortalAccess> visibleContract(@Param("agency") Long agency, @Param("account") Long account, @Param("target") Long target);

    @Query("select a from ClientPortalAccess a where " + SCOPE + " and " + CLAIM + " and a.sinistre.id = :target")
    Optional<ClientPortalAccess> visibleClaim(@Param("agency") Long agency, @Param("account") Long account, @Param("target") Long target);

    @Query("select count(a) from ClientPortalAccess a where " + SCOPE + " and " + CONTRACT)
    long countContracts(@Param("agency") Long agency, @Param("account") Long account);

    @Query("select count(a) from ClientPortalAccess a where " + SCOPE + " and " + CONTRACT
            + " and a.contrat.statut = com.assurance.enums.StatutContrat.ACTIVE and a.contrat.dateEffet <= :today and a.contrat.dateEcheance >= :today")
    long countActiveContracts(@Param("agency") Long agency, @Param("account") Long account, @Param("today") java.time.LocalDate today);

    @Query("select count(a) from ClientPortalAccess a where " + SCOPE + " and " + CONTRACT
            + " and a.contrat.statut = com.assurance.enums.StatutContrat.ACTIVE and a.contrat.dateEcheance between :today and :until")
    long countExpiringContracts(@Param("agency") Long agency, @Param("account") Long account,
                               @Param("today") java.time.LocalDate today, @Param("until") java.time.LocalDate until);

    @Query("select count(a) from ClientPortalAccess a where " + SCOPE + " and " + CLAIM)
    long countClaims(@Param("agency") Long agency, @Param("account") Long account);

    @Query("select count(a) from ClientPortalAccess a where " + SCOPE + " and " + CLAIM
            + " and a.sinistre.statut not in (com.assurance.enums.StatutSinistre.CLOTURE, com.assurance.enums.StatutSinistre.REJETE, com.assurance.enums.StatutSinistre.ANNULE, com.assurance.enums.StatutSinistre.REGLE)")
    long countOpenClaims(@Param("agency") Long agency, @Param("account") Long account);
}
