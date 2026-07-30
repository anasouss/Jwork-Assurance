package com.assurance.repository;

import com.assurance.entity.Quittance;
import com.assurance.enums.TypeContrat;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.Collection;
import jakarta.persistence.LockModeType;

public interface QuittanceRepository extends JpaRepository<Quittance, Long> {
    List<Quittance> findByContratIdOrderByCreatedAtDesc(Long contratId);

    List<Quittance> findByContrat_IdAndElementFacturable_IdOrderByCreatedAtDesc(Long contratId, Long elementFacturableId);

    List<Quittance> findByMouvementContratIdOrderByCreatedAtDesc(Long mouvementContratId);

    Optional<Quittance> findFirstByMouvementContratIdOrderByCreatedAtAsc(Long mouvementContratId);

    Optional<Quittance> findFirstByContratIdAndGlobaleTrueOrderByCreatedAtDesc(Long contratId);

    @EntityGraph(attributePaths = {"mouvementContrat", "elementFacturable"})
    List<Quittance> findByContratIdAndGlobaleTrueOrderByCreatedAtAsc(Long contratId);

    @EntityGraph(attributePaths = {
            "contrat",
            "contrat.compagnieAssurance",
            "mouvementContrat",
            "mouvementContrat.typeMouvement",
            "compagnieAssurance"
    })
    Optional<Quittance> findByContratAgenceIdAndIdAndGlobaleTrue(Long agenceId, Long id);

    @EntityGraph(attributePaths = {
            "contrat",
            "contrat.compagnieAssurance",
            "mouvementContrat",
            "mouvementContrat.typeMouvement",
            "compagnieAssurance"
    })
    @Query(value = """
            select q
            from Quittance q
            join q.contrat c
            left join q.mouvementContrat m
            left join m.typeMouvement tm
            join q.compagnieAssurance ca
            where c.agence.id = :agenceId
              and q.globale = true
              and q.alternative = false
              and c.prospection = false
              and (m is null or m.statut = com.assurance.enums.StatutMouvementContrat.VALIDE)
              and (
                    q.elementFacturable is null
                    or q.elementFacturable.statut <> com.assurance.enums.StatutElementFacturable.ANNULE
              )
              and (:compagnieId is null or ca.id = :compagnieId)
              and (:typeContrat is null or c.typeContrat = :typeContrat)
              and (
                    :avecQuittance is null
                    or (
                        :avecQuittance = true
                        and exists (
                            select 1
                            from AffectationQuittanceCompagnie aq
                            where aq.quittance = q
                        )
                    )
                    or (
                        :avecQuittance = false
                        and not exists (
                            select 1
                            from AffectationQuittanceCompagnie aq
                            where aq.quittance = q
                        )
                    )
              )
              and (:dateDu is null or q.dateDebut >= :dateDu)
              and (:dateAu is null or q.dateDebut <= :dateAu)
              and (
                    :search is null
                    or lower(coalesce(c.numeroDossier, '')) like concat('%', :search, '%')
                    or lower(coalesce(c.numeroPolice, '')) like concat('%', :search, '%')
                    or lower(coalesce(c.numeroContrat, '')) like concat('%', :search, '%')
                    or lower(coalesce(q.numeroQuittance, '')) like concat('%', :search, '%')
                    or lower(coalesce(ca.nom, '')) like concat('%', :search, '%')
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
                                or lower(coalesce(cl.raisonSociale, '')) like concat('%', :search, '%')
                                or lower(coalesce(cl.nom, '')) like concat('%', :search, '%')
                                or lower(coalesce(cl.prenom, '')) like concat('%', :search, '%')
                          )
                    )
                    or exists (
                        select 1
                        from Vehicule v
                        where v.contrat = c
                          and lower(coalesce(v.immatriculation, '')) like concat('%', :search, '%')
                    )
                    or exists (
                        select 1
                        from AffectationQuittanceCompagnie a
                        where a.quittance = q
                          and lower(a.numeroQuittanceCompagnie) like concat('%', :search, '%')
                    )
              )
            order by q.dateDebut desc, q.id desc
            """, countQuery = """
            select count(q.id)
            from Quittance q
            join q.contrat c
            left join q.mouvementContrat m
            left join m.typeMouvement tm
            join q.compagnieAssurance ca
            where c.agence.id = :agenceId
              and q.globale = true
              and q.alternative = false
              and c.prospection = false
              and (m is null or m.statut = com.assurance.enums.StatutMouvementContrat.VALIDE)
              and (
                    q.elementFacturable is null
                    or q.elementFacturable.statut <> com.assurance.enums.StatutElementFacturable.ANNULE
              )
              and (:compagnieId is null or ca.id = :compagnieId)
              and (:typeContrat is null or c.typeContrat = :typeContrat)
              and (
                    :avecQuittance is null
                    or (
                        :avecQuittance = true
                        and exists (
                            select 1
                            from AffectationQuittanceCompagnie aq
                            where aq.quittance = q
                        )
                    )
                    or (
                        :avecQuittance = false
                        and not exists (
                            select 1
                            from AffectationQuittanceCompagnie aq
                            where aq.quittance = q
                        )
                    )
              )
              and (:dateDu is null or q.dateDebut >= :dateDu)
              and (:dateAu is null or q.dateDebut <= :dateAu)
              and (
                    :search is null
                    or lower(coalesce(c.numeroDossier, '')) like concat('%', :search, '%')
                    or lower(coalesce(c.numeroPolice, '')) like concat('%', :search, '%')
                    or lower(coalesce(c.numeroContrat, '')) like concat('%', :search, '%')
                    or lower(coalesce(q.numeroQuittance, '')) like concat('%', :search, '%')
                    or lower(coalesce(ca.nom, '')) like concat('%', :search, '%')
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
                                or lower(coalesce(cl.raisonSociale, '')) like concat('%', :search, '%')
                                or lower(coalesce(cl.nom, '')) like concat('%', :search, '%')
                                or lower(coalesce(cl.prenom, '')) like concat('%', :search, '%')
                          )
                    )
                    or exists (
                        select 1
                        from Vehicule v
                        where v.contrat = c
                          and lower(coalesce(v.immatriculation, '')) like concat('%', :search, '%')
                    )
                    or exists (
                        select 1
                        from AffectationQuittanceCompagnie a
                        where a.quittance = q
                          and lower(a.numeroQuittanceCompagnie) like concat('%', :search, '%')
                    )
              )
            """)
    Page<Quittance> searchForAffectation(
            @Param("agenceId") Long agenceId,
            @Param("compagnieId") Long compagnieId,
            @Param("typeContrat") TypeContrat typeContrat,
            @Param("avecQuittance") Boolean avecQuittance,
            @Param("dateDu") LocalDate dateDu,
            @Param("dateAu") LocalDate dateAu,
            @Param("search") String search,
            Pageable pageable
    );

    @EntityGraph(attributePaths = {
            "contrat",
            "contrat.compagnieAssurance",
            "contrat.payeurPrime",
            "contrat.payeurPrime.ville",
            "contrat.groupeFacturation",
            "contrat.groupeFacturation.clientTresorerie",
            "mouvementContrat",
            "mouvementContrat.typeMouvement",
            "compagnieAssurance"
    })
    @Query(value = """
            select q
            from Quittance q
            join q.contrat c
            left join q.mouvementContrat m
            left join c.payeurPrime pp
            left join c.groupeFacturation gf
            where c.agence.id = :agenceId
              and q.globale = true
              and q.alternative = false
              and c.prospection = false
              and (m is null or m.statut = com.assurance.enums.StatutMouvementContrat.VALIDE)
              and (
                    q.elementFacturable is null
                    or q.elementFacturable.statut <> com.assurance.enums.StatutElementFacturable.ANNULE
              )
              and (:typeContrat is null or c.typeContrat = :typeContrat)
              and (:dateDu is null or q.dateDebut >= :dateDu)
              and (:dateAu is null or q.dateDebut <= :dateAu)
              and (
                    :search is null
                    or lower(coalesce(c.numeroDossier, '')) like concat('%', :search, '%')
                    or lower(coalesce(c.numeroPolice, '')) like concat('%', :search, '%')
                    or lower(coalesce(q.numeroQuittance, '')) like concat('%', :search, '%')
                    or lower(coalesce(pp.codeClient, '')) like concat('%', :search, '%')
                    or lower(coalesce(pp.raisonSociale, '')) like concat('%', :search, '%')
                    or lower(coalesce(pp.nom, '')) like concat('%', :search, '%')
                    or lower(coalesce(gf.code, '')) like concat('%', :search, '%')
                    or lower(coalesce(gf.libelle, '')) like concat('%', :search, '%')
                    or exists (
                        select 1
                        from ContratClient cc
                        join cc.client cl
                        where cc.contrat = c
                          and cc.role = com.assurance.enums.RoleClientContrat.SOUSCRIPTEUR
                          and (
                                lower(coalesce(cl.codeClient, '')) like concat('%', :search, '%')
                                or lower(coalesce(cl.rc, '')) like concat('%', :search, '%')
                                or lower(coalesce(cl.cin, '')) like concat('%', :search, '%')
                                or lower(coalesce(cl.ice, '')) like concat('%', :search, '%')
                                or lower(coalesce(cl.raisonSociale, '')) like concat('%', :search, '%')
                                or lower(coalesce(cl.nom, '')) like concat('%', :search, '%')
                                or lower(coalesce(cl.prenom, '')) like concat('%', :search, '%')
                          )
                    )
              )
            order by q.dateDebut desc, q.id desc
            """, countQuery = """
            select count(q.id)
            from Quittance q
            join q.contrat c
            left join q.mouvementContrat m
            left join c.payeurPrime pp
            left join c.groupeFacturation gf
            where c.agence.id = :agenceId
              and q.globale = true
              and q.alternative = false
              and c.prospection = false
              and (m is null or m.statut = com.assurance.enums.StatutMouvementContrat.VALIDE)
              and (
                    q.elementFacturable is null
                    or q.elementFacturable.statut <> com.assurance.enums.StatutElementFacturable.ANNULE
              )
              and (:typeContrat is null or c.typeContrat = :typeContrat)
              and (:dateDu is null or q.dateDebut >= :dateDu)
              and (:dateAu is null or q.dateDebut <= :dateAu)
              and (
                    :search is null
                    or lower(coalesce(c.numeroDossier, '')) like concat('%', :search, '%')
                    or lower(coalesce(c.numeroPolice, '')) like concat('%', :search, '%')
                    or lower(coalesce(q.numeroQuittance, '')) like concat('%', :search, '%')
                    or lower(coalesce(pp.codeClient, '')) like concat('%', :search, '%')
                    or lower(coalesce(pp.raisonSociale, '')) like concat('%', :search, '%')
                    or lower(coalesce(pp.nom, '')) like concat('%', :search, '%')
                    or lower(coalesce(gf.code, '')) like concat('%', :search, '%')
                    or lower(coalesce(gf.libelle, '')) like concat('%', :search, '%')
                    or exists (
                        select 1
                        from ContratClient cc
                        join cc.client cl
                        where cc.contrat = c
                          and cc.role = com.assurance.enums.RoleClientContrat.SOUSCRIPTEUR
                          and (
                                lower(coalesce(cl.codeClient, '')) like concat('%', :search, '%')
                                or lower(coalesce(cl.rc, '')) like concat('%', :search, '%')
                                or lower(coalesce(cl.cin, '')) like concat('%', :search, '%')
                                or lower(coalesce(cl.ice, '')) like concat('%', :search, '%')
                                or lower(coalesce(cl.raisonSociale, '')) like concat('%', :search, '%')
                                or lower(coalesce(cl.nom, '')) like concat('%', :search, '%')
                                or lower(coalesce(cl.prenom, '')) like concat('%', :search, '%')
                          )
                    )
              )
            """)
    Page<Quittance> searchForClientDocuments(
            @Param("agenceId") Long agenceId,
            @Param("typeContrat") TypeContrat typeContrat,
            @Param("dateDu") LocalDate dateDu,
            @Param("dateAu") LocalDate dateAu,
            @Param("search") String search,
            Pageable pageable
    );

    @EntityGraph(attributePaths = {
            "contrat",
            "contrat.agence",
            "contrat.compagnieAssurance",
            "contrat.payeurPrime",
            "contrat.payeurPrime.ville",
            "contrat.groupeFacturation",
            "contrat.groupeFacturation.clientTresorerie",
            "mouvementContrat",
            "mouvementContrat.typeMouvement",
            "compagnieAssurance",
            "lignes"
    })
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select distinct q
            from Quittance q
            where q.contrat.agence.id = :agenceId
              and q.id in :ids
              and q.globale = true
              and q.alternative = false
            """)
    List<Quittance> findClientDocumentSources(
            @Param("agenceId") Long agenceId,
            @Param("ids") Collection<Long> ids
    );
}
