package com.assurance.repository;

import com.assurance.entity.AssistanceContrat;
import com.assurance.enums.CategorieMouvementContrat;
import com.assurance.enums.StatutMouvementContrat;
import com.assurance.enums.TypeContrat;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.math.BigDecimal;
import java.time.LocalDate;

public interface AssistanceContratRepository extends JpaRepository<AssistanceContrat, Long> {
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
            @Param("categorie") CategorieMouvementContrat categorie,
            @Param("typeContrat") TypeContrat typeContrat,
            @Param("statut") StatutMouvementContrat statut,
            @Param("search") String search
    );

    List<AssistanceContrat> findByContratIdOrderByCreatedAtDesc(Long contratId);

    List<AssistanceContrat> findByContratIdAndActifTrueOrderByCreatedAtDesc(Long contratId);

    List<AssistanceContrat> findByMouvementContratIdOrderByCreatedAtDesc(Long mouvementContratId);

    List<AssistanceContrat> findByMouvementContratIdAndActifTrueOrderByCreatedAtDesc(Long mouvementContratId);

    long countByMouvementContratIdAndActifTrue(Long mouvementContratId);

    long countByContratIdAndActifTrue(Long contratId);

    Optional<AssistanceContrat> findFirstByContratIdAndVehiculeIdAndActifTrueOrderByCreatedAtDesc(Long contratId, Long vehiculeId);

    @EntityGraph(attributePaths = {"vehicule", "vehicule.marque"})
    Optional<AssistanceContrat> findByElementFacturableId(Long elementFacturableId);

    @EntityGraph(attributePaths = {
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
