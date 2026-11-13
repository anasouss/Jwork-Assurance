package com.assurance.repository;

import com.assurance.entity.Contrat;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface SinistreContratLookupRepository extends Repository<Contrat, Long> {

    @EntityGraph(attributePaths = {"brancheAssurance", "compagnieAssurance"})
    @Query("""
            select c from Contrat c
            where c.agence.id = :agenceId
              and c.brancheAssurance.id = :brancheId
              and c.brouillon = false
              and c.prospection = false
              and c.statut <> com.assurance.enums.StatutContrat.DRAFT
              and (
                (:typeRecherche = 'POLICE' and lower(trim(coalesce(c.numeroPolice, ''))) = :value)
                or (:typeRecherche = 'ASSURE' and exists (select cc.id from ContratClient cc where cc.contrat = c
                    and cc.role in (com.assurance.enums.RoleClientContrat.PROPRIETAIRE, com.assurance.enums.RoleClientContrat.SOUSCRIPTEUR)
                    and (lower(coalesce(cc.client.raisonSociale, '')) like :value escape '!'
                         or lower(concat(coalesce(cc.client.prenom, ''), ' ', coalesce(cc.client.nom, ''))) like :value escape '!'
                         or lower(concat(coalesce(cc.client.nom, ''), ' ', coalesce(cc.client.prenom, ''))) like :value escape '!')))
                or (:typeRecherche = 'IMMATRICULATION' and exists (select mv.id from MouvementVehicule mv where mv.mouvementContrat.contrat = c
                    and mv.mouvementContrat.statut = com.assurance.enums.StatutMouvementContrat.VALIDE
                    and (lower(replace(replace(coalesce(mv.immatriculation, ''), ' ', ''), '-', '')) = :value
                         or lower(replace(replace(coalesce(mv.immatriculationProvisoire, ''), ' ', ''), '-', '')) = :value)))
              )
            order by c.dateEffet desc, c.id desc
            """)
    List<Contrat> search(
            @Param("agenceId") Long agenceId,
            @Param("brancheId") Long brancheId,
            @Param("typeRecherche") String typeRecherche,
            @Param("value") String value,
            Pageable pageable
    );

    @Query("""
            select mv from MouvementVehicule mv
            join fetch mv.vehicule
            join fetch mv.mouvementContrat m
            join fetch m.contrat c
            where c.agence.id = :agenceId
              and c.id in :contratIds
              and m.statut = com.assurance.enums.StatutMouvementContrat.VALIDE
              and (lower(replace(replace(coalesce(mv.immatriculation, ''), ' ', ''), '-', '')) = :value
                   or lower(replace(replace(coalesce(mv.immatriculationProvisoire, ''), ' ', ''), '-', '')) = :value)
            order by mv.id desc
            """)
    List<com.assurance.entity.MouvementVehicule> matchingVehicles(
            @Param("agenceId") Long agenceId,
            @Param("contratIds") List<Long> contratIds,
            @Param("value") String value
    );
}
