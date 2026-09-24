package com.assurance.repository;

import com.assurance.entity.MouvementContrat;
import com.assurance.enums.CategorieMouvementContrat;
import com.assurance.enums.StatutMouvementContrat;
import com.assurance.enums.TypeContrat;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface MouvementContratRepository extends JpaRepository<MouvementContrat, Long> {
    String REGISTRE_FILTER = """
            m.agence.id = :agenceId
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
            """;

    @EntityGraph(attributePaths = {"typeMouvement", "contrat", "contrat.compagnieAssurance", "contrat.brancheAssurance"})
    @Query(value = "select m from MouvementContrat m where " + REGISTRE_FILTER,
            countQuery = "select count(m) from MouvementContrat m where " + REGISTRE_FILTER)
    Page<MouvementContrat> searchRegistre(
            @Param("agenceId") Long agenceId,
            @Param("typeDate") String typeDate,
            @Param("dateDu") LocalDate dateDu,
            @Param("dateAu") LocalDate dateAu,
            @Param("brancheId") Long brancheId,
            @Param("compagnieId") Long compagnieId,
            @Param("categorie") CategorieMouvementContrat categorie,
            @Param("typeContrat") TypeContrat typeContrat,
            @Param("statut") StatutMouvementContrat statut,
            @Param("search") String search,
            Pageable pageable
    );

    @Query("""
            select count(m),
                   coalesce(sum(case when m.statut = com.assurance.enums.StatutMouvementContrat.ANNULE then 1 else 0 end), 0),
                   coalesce(sum(case when m.statut = com.assurance.enums.StatutMouvementContrat.VALIDE and m.typeMouvement.categorie = com.assurance.enums.CategorieMouvementContrat.AFFAIRE_NOUVELLE then 1 else 0 end), 0),
                   coalesce(sum(case when m.statut = com.assurance.enums.StatutMouvementContrat.VALIDE and m.typeMouvement.categorie = com.assurance.enums.CategorieMouvementContrat.AVENANT then 1 else 0 end), 0),
                   coalesce(sum(case when m.statut = com.assurance.enums.StatutMouvementContrat.VALIDE and m.typeMouvement.categorie = com.assurance.enums.CategorieMouvementContrat.RENOUVELLEMENT then 1 else 0 end), 0),
                   coalesce(sum(case when m.statut = com.assurance.enums.StatutMouvementContrat.VALIDE then coalesce(m.primeNette, 0) else 0 end), 0),
                   coalesce(sum(case when m.statut = com.assurance.enums.StatutMouvementContrat.VALIDE then coalesce(m.taxe, 0) + coalesce(m.taxeParafiscale, 0) + coalesce(m.accessoire, 0) + coalesce(m.cnpac, 0) else 0 end), 0),
                   coalesce(sum(case when m.statut = com.assurance.enums.StatutMouvementContrat.VALIDE then coalesce(m.primeTotale, 0) else 0 end), 0)
            from MouvementContrat m
            where """ + REGISTRE_FILTER)
    Object[] summarizeRegistre(
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

    long countByAgenceIdAndStatutAndDateEffetBetween(
            Long agenceId,
            StatutMouvementContrat statut,
            LocalDate dateDu,
            LocalDate dateAu
    );

    @EntityGraph(attributePaths = {"typeMouvement", "contrat", "contrat.compagnieAssurance"})
    Page<MouvementContrat> findByAgenceIdAndStatutOrderByCreatedAtDesc(
            Long agenceId,
            StatutMouvementContrat statut,
            Pageable pageable
    );

    List<MouvementContrat> findByContratIdOrderByCreatedAtDesc(Long contratId);

    @EntityGraph(attributePaths = "typeMouvement")
    List<MouvementContrat> findByContratIdInOrderByCreatedAtDesc(List<Long> contratIds);

    Optional<MouvementContrat> findByContratIdAndId(Long contratId, Long id);

    Optional<MouvementContrat> findFirstByContratIdOrderByCreatedAtDesc(Long contratId);
}
