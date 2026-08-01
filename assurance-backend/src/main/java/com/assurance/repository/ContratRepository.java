package com.assurance.repository;

import com.assurance.entity.Contrat;
import com.assurance.enums.TypeContrat;
import com.assurance.enums.StatutContrat;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.time.LocalDate;
import java.time.LocalDateTime;

public interface ContratRepository extends JpaRepository<Contrat, Long> {
    long countByAgenceIdAndProspectionFalseAndBrouillonFalseAndStatut(Long agenceId, StatutContrat statut);

    long countByAgenceIdAndProspectionFalseAndBrouillonTrue(Long agenceId);

    long countByAgenceIdAndProspectionFalseAndBrouillonFalseAndStatutAndDateEcheanceBetween(
            Long agenceId,
            StatutContrat statut,
            LocalDate dateDu,
            LocalDate dateAu
    );

    @Query("""
            select c.typeContrat, count(c)
            from Contrat c
            where c.agence.id = :agenceId
              and c.prospection = false
              and c.brouillon = false
              and c.statut = com.assurance.enums.StatutContrat.ACTIVE
            group by c.typeContrat
            order by c.typeContrat
            """)
    List<Object[]> countActivePortfolioByType(@Param("agenceId") Long agenceId);

    List<Contrat> findByAgenceIdOrderByCreatedAtDesc(Long agenceId);

    @EntityGraph(attributePaths = {"compagnieAssurance", "convention", "contratOrigine"})
    List<Contrat> findByAgenceIdAndIdIn(Long agenceId, List<Long> ids);

    @Query(value = """
            select c.id
            from Contrat c
            where c.agence.id = :agenceId
              and c.prospection = false
              and not exists (
                    select 1
                    from Contrat renewal
                    where renewal.contratOrigine = c
                      and renewal.agence.id = :agenceId
                      and renewal.prospection = false
              )
              and (:typeContrat is null or c.typeContrat = :typeContrat)
              and (:compagnieId is null or c.compagnieAssurance.id = :compagnieId)
              and (:numeroPolice is null or lower(coalesce(c.numeroPolice, '')) like concat('%', :numeroPolice, '%'))
              and (:clientId is null or exists (
                    select 1 from ContratClient cc
                    where cc.contrat = c and cc.client.id = :clientId
              ))
              and (:search is null or
                    lower(coalesce(c.numeroContrat, '')) like concat('%', :search, '%') or
                    lower(coalesce(c.numeroDossier, '')) like concat('%', :search, '%') or
                    lower(coalesce(c.numeroPolice, '')) like concat('%', :search, '%') or
                    lower(coalesce(c.compagnieAssurance.code, '')) like concat('%', :search, '%') or
                    lower(coalesce(c.compagnieAssurance.nom, '')) like concat('%', :search, '%') or
                    exists (
                        select 1 from ContratClient cc
                        where cc.contrat = c and (
                            lower(coalesce(cc.client.codeClient, '')) like concat('%', :search, '%') or
                            lower(coalesce(cc.client.cin, '')) like concat('%', :search, '%') or
                            lower(coalesce(cc.client.rc, '')) like concat('%', :search, '%') or
                            lower(coalesce(cc.client.ice, '')) like concat('%', :search, '%') or
                            lower(coalesce(cc.client.nom, '')) like concat('%', :search, '%') or
                            lower(coalesce(cc.client.prenom, '')) like concat('%', :search, '%') or
                            lower(coalesce(cc.client.raisonSociale, '')) like concat('%', :search, '%')
                        )
                    )
              )
              and (:dateDu is null or
                    (:typeDate = 'EFFET' and c.dateEffet >= :dateDu) or
                    (:typeDate = 'ECHEANCE' and c.dateEcheance >= :dateDu))
              and (:dateAu is null or
                    (:typeDate = 'EFFET' and c.dateEffet <= :dateAu) or
                    (:typeDate = 'ECHEANCE' and c.dateEcheance <= :dateAu))
            order by c.updatedAt desc, c.id desc
            """,
            countQuery = """
            select count(c.id)
            from Contrat c
            where c.agence.id = :agenceId
              and c.prospection = false
              and not exists (
                    select 1
                    from Contrat renewal
                    where renewal.contratOrigine = c
                      and renewal.agence.id = :agenceId
                      and renewal.prospection = false
              )
              and (:typeContrat is null or c.typeContrat = :typeContrat)
              and (:compagnieId is null or c.compagnieAssurance.id = :compagnieId)
              and (:numeroPolice is null or lower(coalesce(c.numeroPolice, '')) like concat('%', :numeroPolice, '%'))
              and (:clientId is null or exists (
                    select 1 from ContratClient cc
                    where cc.contrat = c and cc.client.id = :clientId
              ))
              and (:search is null or
                    lower(coalesce(c.numeroContrat, '')) like concat('%', :search, '%') or
                    lower(coalesce(c.numeroDossier, '')) like concat('%', :search, '%') or
                    lower(coalesce(c.numeroPolice, '')) like concat('%', :search, '%') or
                    lower(coalesce(c.compagnieAssurance.code, '')) like concat('%', :search, '%') or
                    lower(coalesce(c.compagnieAssurance.nom, '')) like concat('%', :search, '%') or
                    exists (
                        select 1 from ContratClient cc
                        where cc.contrat = c and (
                            lower(coalesce(cc.client.codeClient, '')) like concat('%', :search, '%') or
                            lower(coalesce(cc.client.cin, '')) like concat('%', :search, '%') or
                            lower(coalesce(cc.client.rc, '')) like concat('%', :search, '%') or
                            lower(coalesce(cc.client.ice, '')) like concat('%', :search, '%') or
                            lower(coalesce(cc.client.nom, '')) like concat('%', :search, '%') or
                            lower(coalesce(cc.client.prenom, '')) like concat('%', :search, '%') or
                            lower(coalesce(cc.client.raisonSociale, '')) like concat('%', :search, '%')
                        )
                    )
              )
              and (:dateDu is null or
                    (:typeDate = 'EFFET' and c.dateEffet >= :dateDu) or
                    (:typeDate = 'ECHEANCE' and c.dateEcheance >= :dateDu))
              and (:dateAu is null or
                    (:typeDate = 'EFFET' and c.dateEffet <= :dateAu) or
                    (:typeDate = 'ECHEANCE' and c.dateEcheance <= :dateAu))
            """)
    Page<Long> searchCurrentContractIds(
            @Param("agenceId") Long agenceId,
            @Param("typeContrat") TypeContrat typeContrat,
            @Param("typeDate") String typeDate,
            @Param("dateDu") LocalDate dateDu,
            @Param("dateAu") LocalDate dateAu,
            @Param("search") String search,
            @Param("compagnieId") Long compagnieId,
            @Param("numeroPolice") String numeroPolice,
            @Param("clientId") Long clientId,
            Pageable pageable
    );

    @Query(value = """
            select c.id
            from Contrat c
            where c.agence.id = :agenceId
              and c.prospection = true
              and c.typeContrat = com.assurance.enums.TypeContrat.FLOTTE
              and (:compagnieId is null or c.compagnieAssurance.id = :compagnieId)
              and (:dateDu is null or c.createdAt >= :dateDu)
              and (:dateAuExclusive is null or c.createdAt < :dateAuExclusive)
              and (:numeroDevis is null or
                    lower(coalesce(c.numeroDevis, '')) like concat('%', :numeroDevis, '%') or
                    lower(coalesce(c.numeroPolice, '')) like concat('%', :numeroDevis, '%'))
              and (:search is null or
                    lower(coalesce(c.numeroDossier, '')) like concat('%', :search, '%') or
                    lower(coalesce(c.compagnieAssurance.code, '')) like concat('%', :search, '%') or
                    lower(coalesce(c.compagnieAssurance.nom, '')) like concat('%', :search, '%') or
                    exists (
                        select 1 from ContratClient cc
                        where cc.contrat = c and (
                            lower(coalesce(cc.client.codeClient, '')) like concat('%', :search, '%') or
                            lower(coalesce(cc.client.cin, '')) like concat('%', :search, '%') or
                            lower(coalesce(cc.client.rc, '')) like concat('%', :search, '%') or
                            lower(coalesce(cc.client.raisonSociale, '')) like concat('%', :search, '%') or
                            lower(coalesce(cc.client.nom, '')) like concat('%', :search, '%') or
                            lower(coalesce(cc.client.prenom, '')) like concat('%', :search, '%')
                        )
                    )
              )
            order by c.createdAt desc, c.id desc
            """,
            countQuery = """
            select count(c.id)
            from Contrat c
            where c.agence.id = :agenceId
              and c.prospection = true
              and c.typeContrat = com.assurance.enums.TypeContrat.FLOTTE
              and (:compagnieId is null or c.compagnieAssurance.id = :compagnieId)
              and (:dateDu is null or c.createdAt >= :dateDu)
              and (:dateAuExclusive is null or c.createdAt < :dateAuExclusive)
              and (:numeroDevis is null or
                    lower(coalesce(c.numeroDevis, '')) like concat('%', :numeroDevis, '%') or
                    lower(coalesce(c.numeroPolice, '')) like concat('%', :numeroDevis, '%'))
              and (:search is null or
                    lower(coalesce(c.numeroDossier, '')) like concat('%', :search, '%') or
                    lower(coalesce(c.compagnieAssurance.code, '')) like concat('%', :search, '%') or
                    lower(coalesce(c.compagnieAssurance.nom, '')) like concat('%', :search, '%') or
                    exists (
                        select 1 from ContratClient cc
                        where cc.contrat = c and (
                            lower(coalesce(cc.client.codeClient, '')) like concat('%', :search, '%') or
                            lower(coalesce(cc.client.cin, '')) like concat('%', :search, '%') or
                            lower(coalesce(cc.client.rc, '')) like concat('%', :search, '%') or
                            lower(coalesce(cc.client.raisonSociale, '')) like concat('%', :search, '%') or
                            lower(coalesce(cc.client.nom, '')) like concat('%', :search, '%') or
                            lower(coalesce(cc.client.prenom, '')) like concat('%', :search, '%')
                        )
                    )
              )
            """)
    Page<Long> searchProspectionIds(
            @Param("agenceId") Long agenceId,
            @Param("compagnieId") Long compagnieId,
            @Param("dateDu") LocalDateTime dateDu,
            @Param("dateAuExclusive") LocalDateTime dateAuExclusive,
            @Param("search") String search,
            @Param("numeroDevis") String numeroDevis,
            Pageable pageable
    );

    @EntityGraph(attributePaths = {
            "agence",
            "compagnieAssurance",
            "convention"
    })
    Optional<Contrat> findByAgenceIdAndId(Long agenceId, Long id);

    Optional<Contrat> findFirstByAgenceIdAndContratOrigineIdAndStatutAndBrouillonTrueOrderByCreatedAtDesc(
            Long agenceId,
            Long contratOrigineId,
            StatutContrat statut
    );

    boolean existsByAgenceIdAndNumeroContrat(Long agenceId, String numeroContrat);

    boolean existsByAgenceIdAndNumeroContratAndIdNot(Long agenceId, String numeroContrat, Long id);

    boolean existsByAgenceIdAndNumeroDossier(Long agenceId, String numeroDossier);

    boolean existsByAgenceIdAndNumeroDevis(Long agenceId, String numeroDevis);

    @Query("""
            select c.numeroDevis
            from Contrat c
            where c.agence.id = :agenceId
              and c.numeroDevis is not null
              and upper(c.numeroDevis) like concat(:prefix, '%')
            """)
    List<String> findNumeroDevisByAgenceIdAndPrefix(@Param("agenceId") Long agenceId, @Param("prefix") String prefix);

    @Query(value = """
            select c.id
            from Contrat c
            left join c.compagnieAssurance ca
            where c.agence.id = :agenceId
              and c.prospection = false
              and c.brouillon = false
              and c.dateEcheance between :dateDu and :dateAu
              and (:compagnieId is null or ca.id = :compagnieId)
              and (:typeContrat is null or c.typeContrat = :typeContrat)
              and (
                    :search is null
                    or lower(coalesce(c.numeroDossier, '')) like concat('%', :search, '%')
                    or lower(coalesce(c.numeroContrat, '')) like concat('%', :search, '%')
                    or lower(coalesce(c.numeroPolice, '')) like concat('%', :search, '%')
                    or lower(coalesce(ca.nom, '')) like concat('%', :search, '%')
                    or lower(coalesce(ca.code, '')) like concat('%', :search, '%')
                    or exists (
                        select 1
                        from ContratClient cc
                        join cc.client cl
                        where cc.contrat = c
                          and (
                                lower(coalesce(cl.codeClient, '')) like concat('%', :search, '%')
                                or lower(coalesce(cl.rc, '')) like concat('%', :search, '%')
                                or lower(coalesce(cl.cin, '')) like concat('%', :search, '%')
                                or lower(coalesce(cl.ice, '')) like concat('%', :search, '%')
                                or lower(coalesce(cl.telephone, '')) like concat('%', :search, '%')
                                or lower(coalesce(cl.raisonSociale, '')) like concat('%', :search, '%')
                                or lower(coalesce(cl.nom, '')) like concat('%', :search, '%')
                                or lower(coalesce(cl.prenom, '')) like concat('%', :search, '%')
                          )
                    )
                    or exists (
                        select 1
                        from Vehicule v
                        left join v.marque m
                        where v.contrat = c
                          and (
                                lower(coalesce(v.immatriculation, '')) like concat('%', :search, '%')
                                or lower(coalesce(m.libelle, '')) like concat('%', :search, '%')
                          )
                    )
              )
            order by c.dateEcheance asc, c.numeroDossier asc, c.id asc
            """, countQuery = """
            select count(c.id)
            from Contrat c
            left join c.compagnieAssurance ca
            where c.agence.id = :agenceId
              and c.prospection = false
              and c.brouillon = false
              and c.dateEcheance between :dateDu and :dateAu
              and (:compagnieId is null or ca.id = :compagnieId)
              and (:typeContrat is null or c.typeContrat = :typeContrat)
              and (
                    :search is null
                    or lower(coalesce(c.numeroDossier, '')) like concat('%', :search, '%')
                    or lower(coalesce(c.numeroContrat, '')) like concat('%', :search, '%')
                    or lower(coalesce(c.numeroPolice, '')) like concat('%', :search, '%')
                    or lower(coalesce(ca.nom, '')) like concat('%', :search, '%')
                    or lower(coalesce(ca.code, '')) like concat('%', :search, '%')
                    or exists (
                        select 1
                        from ContratClient cc
                        join cc.client cl
                        where cc.contrat = c
                          and (
                                lower(coalesce(cl.codeClient, '')) like concat('%', :search, '%')
                                or lower(coalesce(cl.rc, '')) like concat('%', :search, '%')
                                or lower(coalesce(cl.cin, '')) like concat('%', :search, '%')
                                or lower(coalesce(cl.ice, '')) like concat('%', :search, '%')
                                or lower(coalesce(cl.telephone, '')) like concat('%', :search, '%')
                                or lower(coalesce(cl.raisonSociale, '')) like concat('%', :search, '%')
                                or lower(coalesce(cl.nom, '')) like concat('%', :search, '%')
                                or lower(coalesce(cl.prenom, '')) like concat('%', :search, '%')
                          )
                    )
                    or exists (
                        select 1
                        from Vehicule v
                        left join v.marque m
                        where v.contrat = c
                          and (
                                lower(coalesce(v.immatriculation, '')) like concat('%', :search, '%')
                                or lower(coalesce(m.libelle, '')) like concat('%', :search, '%')
                          )
                    )
              )
            """)
    Page<Long> findAutomobileEcheanceIds(
            @Param("agenceId") Long agenceId,
            @Param("dateDu") java.time.LocalDate dateDu,
            @Param("dateAu") java.time.LocalDate dateAu,
            @Param("compagnieId") Long compagnieId,
            @Param("typeContrat") TypeContrat typeContrat,
            @Param("search") String search,
            Pageable pageable
    );

    @EntityGraph(attributePaths = {
            "compagnieAssurance",
            "payeurPrime",
            "groupeFacturation",
            "clients",
            "clients.client"
    })
    @Query("""
            select distinct contrat
            from Contrat contrat
            left join contrat.clients lien
            where contrat.agence.id = :agenceId
              and (
                    lien.client.id = :clientId
                    or contrat.payeurPrime.id = :clientId
              )
            order by contrat.createdAt desc, contrat.id desc
            """)
    List<Contrat> findForClientCrm(
            @Param("agenceId") Long agenceId,
            @Param("clientId") Long clientId
    );
}
