package com.assurance.repository;

import com.assurance.entity.AssistanceContrat;
import com.assurance.enums.CategorieMouvementContrat;
import com.assurance.enums.StatutMouvementContrat;
import com.assurance.enums.TypeContrat;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface AssistanceContratRepository extends JpaRepository<AssistanceContrat, Long> {
    @Query("""
            select count(a)
            from AssistanceContrat a
            where a.contrat.agence.id = :agenceId
              and a.actif = true
              and a.contrat.prospection = false
              and a.contrat.brouillon = false
              and a.contrat.statut = com.assurance.enums.StatutContrat.ACTIVE
              and a.mouvementContrat.statut = com.assurance.enums.StatutMouvementContrat.VALIDE
              and a.dateEffet <= :dateReference
              and a.dateEcheance >= :dateReference
            """)
    long countActiveAt(
            @Param("agenceId") Long agenceId,
            @Param("dateReference") LocalDate dateReference
    );

    @Query("""
            select a.id
            from AssistanceContrat a
            left join a.compagnieAssistance compagnie
            left join a.produitAssistance produit
            left join a.vehicule vehicule
            where a.contrat.agence.id = :agenceId
              and a.actif = true
              and a.contrat.prospection = false
              and a.contrat.brouillon = false
              and a.contrat.statut = com.assurance.enums.StatutContrat.ACTIVE
              and a.dateEcheance between :dateDu and :dateAu
              and (:compagnieId is null or compagnie.id = :compagnieId)
              and (:produitId is null or produit.id = :produitId)
              and (:typeAssistance is null or lower(produit.type) = :typeAssistance)
              and (:search is null
                   or lower(coalesce(a.numeroDossier, '')) like concat('%', :search, '%')
                   or lower(coalesce(a.numeroContratOuQuittance, '')) like concat('%', :search, '%')
                   or lower(coalesce(a.numeroPoliceContrat, '')) like concat('%', :search, '%')
                   or lower(coalesce(a.produit, '')) like concat('%', :search, '%')
                   or lower(coalesce(compagnie.nom, '')) like concat('%', :search, '%')
                   or lower(coalesce(vehicule.immatriculation, '')) like concat('%', :search, '%')
                   or exists (select cc.id from ContratClient cc
                              where cc.contrat = a.contrat
                                and (lower(coalesce(cc.client.codeClient, '')) like concat('%', :search, '%')
                                     or lower(coalesce(cc.client.rc, '')) like concat('%', :search, '%')
                                     or lower(coalesce(cc.client.cin, '')) like concat('%', :search, '%')
                                     or lower(coalesce(cc.client.ice, '')) like concat('%', :search, '%')
                                     or lower(coalesce(cc.client.raisonSociale, '')) like concat('%', :search, '%')
                                     or lower(coalesce(cc.client.nom, '')) like concat('%', :search, '%')
                                     or lower(coalesce(cc.client.prenom, '')) like concat('%', :search, '%'))))
            order by a.dateEcheance asc, a.id asc
            """)
    Page<Long> findEcheanceIds(
            @Param("agenceId") Long agenceId,
            @Param("dateDu") LocalDate dateDu,
            @Param("dateAu") LocalDate dateAu,
            @Param("compagnieId") Long compagnieId,
            @Param("produitId") Long produitId,
            @Param("typeAssistance") String typeAssistance,
            @Param("search") String search,
            Pageable pageable
    );

    @EntityGraph(attributePaths = {
            "brancheAssurance",
            "contrat",
            "contrat.brancheAssurance",
            "contrat.clients",
            "contrat.clients.client",
            "compagnieAssistance",
            "produitAssistance",
            "vehicule"
    })
    @Query("""
            select distinct a
            from AssistanceContrat a
            where a.contrat.agence.id = :agenceId
              and a.id in :ids
            """)
    List<AssistanceContrat> findEcheancesByAgenceIdAndIdIn(
            @Param("agenceId") Long agenceId,
            @Param("ids") Collection<Long> ids
    );

    @Query("""
            select case when count(a.id) > 0 then true else false end
            from AssistanceContrat a
            left join a.produitAssistance produit
            left join a.tarifProduitAssistance tarif
            left join tarif.produitAssistance produitTarif
            where produit.id = :produitId
               or produitTarif.id = :produitId
            """)
    boolean existsByProduitOrTarifProduit(@Param("produitId") Long produitId);

    @Query("""
            select a.mouvementContrat.id, coalesce(sum(a.primeTotale), 0)
            from AssistanceContrat a
            where a.mouvementContrat.id in :mouvementIds and a.actif = true
            group by a.mouvementContrat.id
            """)
    List<Object[]> sumTtcByMouvementIds(@Param("mouvementIds") Collection<Long> mouvementIds);

    @Query("""
            select coalesce(sum(a.primeTotale), 0)
            from AssistanceContrat a
            join a.mouvementContrat m
            where a.actif = true
              and m.statut = com.assurance.enums.StatutMouvementContrat.VALIDE
              and m.agence.id = :agenceId
              and m.statut in (com.assurance.enums.StatutMouvementContrat.VALIDE,
                               com.assurance.enums.StatutMouvementContrat.ANNULE)
              and (:statut is null or m.statut = :statut)
              and ((:typeDate = 'EFFET' and m.dateEffet between :dateDu and :dateAu)
                   or (:typeDate = 'VALIDATION' and m.dateValidation between :dateDu and :dateAu))
              and (:brancheId is null or m.contrat.brancheAssurance.id = :brancheId)
              and (:compagnieId is null or m.contrat.compagnieAssurance.id = :compagnieId)
              and (:compagnieAssistanceId is null or a.compagnieAssistance.id = :compagnieAssistanceId)
              and (:typeAssistance is null or lower(a.produitAssistance.type) = lower(:typeAssistance))
              and (:produitAssistanceId is null or a.produitAssistance.id = :produitAssistanceId)
              and (:categorie is null or m.typeMouvement.categorie = :categorie)
              and (:typeContrat is null or m.contrat.typeContrat = :typeContrat)
              and (:search is null or :search = ''
                   or lower(coalesce(m.contrat.numeroDossier, '')) like lower(concat('%', :search, '%'))
                   or lower(coalesce(m.contrat.numeroPolice, '')) like lower(concat('%', :search, '%'))
                   or lower(coalesce(m.numeroMouvement, '')) like lower(concat('%', :search, '%'))
                   or exists (select cc.id from ContratClient cc
                              where cc.contrat = m.contrat
                                and (lower(coalesce(cc.client.codeClient, '')) like lower(concat('%', :search, '%'))
                                     or lower(coalesce(cc.client.raisonSociale, '')) like lower(concat('%', :search, '%'))
                                     or lower(concat(coalesce(cc.client.prenom, ''), ' ', coalesce(cc.client.nom, ''))) like lower(concat('%', :search, '%'))
                                     or lower(concat(coalesce(cc.client.nom, ''), ' ', coalesce(cc.client.prenom, ''))) like lower(concat('%', :search, '%')))))
            """)
    BigDecimal sumRegistreTtc(
            @Param("agenceId") Long agenceId,
            @Param("typeDate") String typeDate,
            @Param("dateDu") LocalDate dateDu,
            @Param("dateAu") LocalDate dateAu,
            @Param("brancheId") Long brancheId,
            @Param("compagnieId") Long compagnieId,
            @Param("compagnieAssistanceId") Long compagnieAssistanceId,
            @Param("typeAssistance") String typeAssistance,
            @Param("produitAssistanceId") Long produitAssistanceId,
            @Param("categorie") CategorieMouvementContrat categorie,
            @Param("typeContrat") TypeContrat typeContrat,
            @Param("statut") StatutMouvementContrat statut,
            @Param("search") String search
    );

    List<AssistanceContrat> findByContratIdOrderByCreatedAtDesc(Long contratId);

    List<AssistanceContrat> findByContratIdAndActifTrueOrderByCreatedAtDesc(Long contratId);

    @EntityGraph(attributePaths = {"brancheAssurance", "compagnieAssistance", "produitAssistance"})
    List<AssistanceContrat> findByContratIdInAndActifTrueOrderByCreatedAtDesc(Collection<Long> contratIds);

    @EntityGraph(attributePaths = {"mouvementContrat", "compagnieAssistance", "produitAssistance"})
    List<AssistanceContrat> findByMouvementContratIdInAndActifTrueOrderByCreatedAtDesc(Collection<Long> mouvementIds);

    List<AssistanceContrat> findByMouvementContratIdOrderByCreatedAtDesc(Long mouvementContratId);

    List<AssistanceContrat> findByMouvementContratIdAndActifTrueOrderByCreatedAtDesc(Long mouvementContratId);

    long countByMouvementContratIdAndActifTrue(Long mouvementContratId);

    long countByContratIdAndActifTrue(Long contratId);

    Optional<AssistanceContrat> findFirstByContratIdAndVehiculeIdAndActifTrueOrderByCreatedAtDesc(Long contratId, Long vehiculeId);

    @EntityGraph(attributePaths = {"produitAssistance", "vehicule", "vehicule.marque"})
    Optional<AssistanceContrat> findByElementFacturableId(Long elementFacturableId);

    @EntityGraph(attributePaths = {
            "brancheAssurance",
            "compagnieAssistance",
            "produitAssistance",
            "elementFacturable",
            "vehicule",
            "vehicule.marque"
    })
    @Query("""
            select a
            from AssistanceContrat a
            where a.elementFacturable.id in :elementIds
              and a.actif = true
            """)
    List<AssistanceContrat> findActiveByElementFacturableIds(
            @Param("elementIds") Collection<Long> elementIds
    );
}
