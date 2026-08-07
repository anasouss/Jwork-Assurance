package com.assurance.repository;

import com.assurance.entity.ElementFacturable;
import com.assurance.enums.TypeContrat;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ElementFacturableRepository extends JpaRepository<ElementFacturable, Long> {
    List<ElementFacturable> findByAgenceIdOrderByCreatedAtDesc(Long agenceId);

    List<ElementFacturable> findByContratIdOrderByCreatedAtDesc(Long contratId);

    List<ElementFacturable> findByContratIdInAndActifTrueOrderByDateDebutAscIdAsc(List<Long> contratIds);

    List<ElementFacturable> findByMouvementContratIdOrderByCreatedAtDesc(Long mouvementContratId);

    Optional<ElementFacturable> findFirstByMouvementContratIdOrderByCreatedAtAsc(Long mouvementContratId);

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
            select e
            from ElementFacturable e
            join e.contrat c
            left join e.mouvementContrat m
            left join c.payeurPrime pp
            left join c.groupeFacturation gf
            where e.agence.id = :agenceId
              and e.actif = true
              and e.statut <> com.assurance.enums.StatutElementFacturable.ANNULE
              and c.prospection = false
              and not (
                    c.typeContrat = com.assurance.enums.TypeContrat.CONVENTION
                    and lower(trim(coalesce(c.modeReglement, ''))) = 'facture'
              )
              and (:brancheId is null or c.brancheAssurance.id = :brancheId)
              and (m is null or m.statut = com.assurance.enums.StatutMouvementContrat.VALIDE)
              and (:typeContrat is null or c.typeContrat = :typeContrat)
              and (:dateDu is null or e.dateDebut >= :dateDu)
              and (:dateAu is null or e.dateDebut <= :dateAu)
              and (
                    (
                        e.nature = com.assurance.enums.NatureElementFacturable.ASSISTANCE
                        and exists (
                            select 1
                            from AssistanceContrat assistance
                            where assistance.elementFacturable = e
                              and assistance.actif = true
                        )
                    )
                    or exists (
                        select 1
                        from Quittance q
                        where q.elementFacturable = e
                          and q.globale = true
                          and q.alternative = false
                          and q.payee = false
                    )
              )
              and (:payeurId is null or (
                    (
                        :payeurType = 'GROUPE'
                        and gf.id = :payeurId
                        and (
                            c.modeFacturation = com.assurance.enums.ModeFacturationContrat.CONSOLIDEE_GROUPE
                            or c.typePayeurPrime = com.assurance.enums.TypePayeurPrime.TRESORERIE_GROUPE
                        )
                    )
                    or (
                        :payeurType = 'CLIENT'
                        and (
                            gf is null
                            or (
                                (c.modeFacturation is null or c.modeFacturation <> com.assurance.enums.ModeFacturationContrat.CONSOLIDEE_GROUPE)
                                and (c.typePayeurPrime is null or c.typePayeurPrime <> com.assurance.enums.TypePayeurPrime.TRESORERIE_GROUPE)
                            )
                        )
                        and (
                            pp.id = :payeurId
                            or (
                                c.payeurPrime is null
                                and exists (
                                    select 1
                                    from ContratClient payerCc
                                    where payerCc.contrat = c
                                      and payerCc.role = com.assurance.enums.RoleClientContrat.SOUSCRIPTEUR
                                      and payerCc.client.id = :payeurId
                                )
                            )
                        )
                    )
              ))
              and (
                    :search is null
                    or lower(coalesce(c.numeroDossier, '')) like concat('%', :search, '%')
                    or lower(coalesce(c.numeroPolice, '')) like concat('%', :search, '%')
                    or lower(coalesce(e.referenceSource, '')) like concat('%', :search, '%')
                    or lower(coalesce(e.libelle, '')) like concat('%', :search, '%')
                    or lower(coalesce(pp.codeClient, '')) like concat('%', :search, '%')
                    or lower(coalesce(pp.raisonSociale, '')) like concat('%', :search, '%')
                    or lower(coalesce(pp.nom, '')) like concat('%', :search, '%')
                    or lower(coalesce(gf.code, '')) like concat('%', :search, '%')
                    or lower(coalesce(gf.libelle, '')) like concat('%', :search, '%')
                    or exists (
                        select 1
                        from Quittance searchedQuittance
                        where searchedQuittance.elementFacturable = e
                          and lower(coalesce(searchedQuittance.numeroQuittance, '')) like concat('%', :search, '%')
                    )
                    or exists (
                        select 1
                        from AssistanceContrat searchedAssistance
                        where searchedAssistance.elementFacturable = e
                          and searchedAssistance.actif = true
                          and (
                                lower(coalesce(searchedAssistance.numeroContratOuQuittance, '')) like concat('%', :search, '%')
                                or lower(coalesce(searchedAssistance.produit, '')) like concat('%', :search, '%')
                                or lower(coalesce(searchedAssistance.compagnieAssistance.nom, '')) like concat('%', :search, '%')
                          )
                    )
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
            order by e.dateDebut desc, e.id desc
            """, countQuery = """
            select count(e.id)
            from ElementFacturable e
            join e.contrat c
            left join e.mouvementContrat m
            left join c.payeurPrime pp
            left join c.groupeFacturation gf
            where e.agence.id = :agenceId
              and e.actif = true
              and e.statut <> com.assurance.enums.StatutElementFacturable.ANNULE
              and c.prospection = false
              and not (
                    c.typeContrat = com.assurance.enums.TypeContrat.CONVENTION
                    and lower(trim(coalesce(c.modeReglement, ''))) = 'facture'
              )
              and (:brancheId is null or c.brancheAssurance.id = :brancheId)
              and (m is null or m.statut = com.assurance.enums.StatutMouvementContrat.VALIDE)
              and (:typeContrat is null or c.typeContrat = :typeContrat)
              and (:dateDu is null or e.dateDebut >= :dateDu)
              and (:dateAu is null or e.dateDebut <= :dateAu)
              and (
                    (
                        e.nature = com.assurance.enums.NatureElementFacturable.ASSISTANCE
                        and exists (
                            select 1
                            from AssistanceContrat assistance
                            where assistance.elementFacturable = e
                              and assistance.actif = true
                        )
                    )
                    or exists (
                        select 1
                        from Quittance q
                        where q.elementFacturable = e
                          and q.globale = true
                          and q.alternative = false
                          and q.payee = false
                    )
              )
              and (:payeurId is null or (
                    (
                        :payeurType = 'GROUPE'
                        and gf.id = :payeurId
                        and (
                            c.modeFacturation = com.assurance.enums.ModeFacturationContrat.CONSOLIDEE_GROUPE
                            or c.typePayeurPrime = com.assurance.enums.TypePayeurPrime.TRESORERIE_GROUPE
                        )
                    )
                    or (
                        :payeurType = 'CLIENT'
                        and (
                            gf is null
                            or (
                                (c.modeFacturation is null or c.modeFacturation <> com.assurance.enums.ModeFacturationContrat.CONSOLIDEE_GROUPE)
                                and (c.typePayeurPrime is null or c.typePayeurPrime <> com.assurance.enums.TypePayeurPrime.TRESORERIE_GROUPE)
                            )
                        )
                        and (
                            pp.id = :payeurId
                            or (
                                c.payeurPrime is null
                                and exists (
                                    select 1
                                    from ContratClient payerCc
                                    where payerCc.contrat = c
                                      and payerCc.role = com.assurance.enums.RoleClientContrat.SOUSCRIPTEUR
                                      and payerCc.client.id = :payeurId
                                )
                            )
                        )
                    )
              ))
              and (
                    :search is null
                    or lower(coalesce(c.numeroDossier, '')) like concat('%', :search, '%')
                    or lower(coalesce(c.numeroPolice, '')) like concat('%', :search, '%')
                    or lower(coalesce(e.referenceSource, '')) like concat('%', :search, '%')
                    or lower(coalesce(e.libelle, '')) like concat('%', :search, '%')
                    or lower(coalesce(pp.codeClient, '')) like concat('%', :search, '%')
                    or lower(coalesce(pp.raisonSociale, '')) like concat('%', :search, '%')
                    or lower(coalesce(pp.nom, '')) like concat('%', :search, '%')
                    or lower(coalesce(gf.code, '')) like concat('%', :search, '%')
                    or lower(coalesce(gf.libelle, '')) like concat('%', :search, '%')
                    or exists (
                        select 1
                        from Quittance searchedQuittance
                        where searchedQuittance.elementFacturable = e
                          and lower(coalesce(searchedQuittance.numeroQuittance, '')) like concat('%', :search, '%')
                    )
                    or exists (
                        select 1
                        from AssistanceContrat searchedAssistance
                        where searchedAssistance.elementFacturable = e
                          and searchedAssistance.actif = true
                          and (
                                lower(coalesce(searchedAssistance.numeroContratOuQuittance, '')) like concat('%', :search, '%')
                                or lower(coalesce(searchedAssistance.produit, '')) like concat('%', :search, '%')
                                or lower(coalesce(searchedAssistance.compagnieAssistance.nom, '')) like concat('%', :search, '%')
                          )
                    )
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
    Page<ElementFacturable> searchForClientDocuments(
            @Param("agenceId") Long agenceId,
            @Param("brancheId") Long brancheId,
            @Param("typeContrat") TypeContrat typeContrat,
            @Param("dateDu") LocalDate dateDu,
            @Param("dateAu") LocalDate dateAu,
            @Param("payeurType") String payeurType,
            @Param("payeurId") Long payeurId,
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
            "compagnieAssurance"
    })
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select e
            from ElementFacturable e
            where e.agence.id = :agenceId
              and e.id in :ids
              and e.actif = true
              and e.statut <> com.assurance.enums.StatutElementFacturable.ANNULE
            """)
    List<ElementFacturable> findClientDocumentSourcesForUpdate(
            @Param("agenceId") Long agenceId,
            @Param("ids") Collection<Long> ids
    );
}
