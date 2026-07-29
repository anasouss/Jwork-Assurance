package com.assurance.repository;

import com.assurance.entity.GroupeClientMembre;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface GroupeClientMembreRepository extends JpaRepository<GroupeClientMembre, Long> {

    @EntityGraph(attributePaths = {"groupe", "groupe.clientTete", "groupe.clientTresorerie"})
    @Query("""
            select membre
            from GroupeClientMembre membre
            where membre.client.id = :clientId
              and membre.groupe.agence.id = :agenceId
              and membre.groupe.actif = true
              and membre.dateDebut <= :date
              and (membre.dateFin is null or membre.dateFin > :date)
            order by membre.principal desc, membre.dateDebut desc
            """)
    List<GroupeClientMembre> findActiveByClient(
            @Param("agenceId") Long agenceId,
            @Param("clientId") Long clientId,
            @Param("date") LocalDate date
    );

    @EntityGraph(attributePaths = {"client"})
    @Query("""
            select membre
            from GroupeClientMembre membre
            where membre.groupe.id = :groupeId
              and membre.groupe.agence.id = :agenceId
              and membre.dateDebut <= :date
              and (membre.dateFin is null or membre.dateFin > :date)
            order by membre.principal desc, membre.client.raisonSociale asc, membre.client.nom asc
            """)
    List<GroupeClientMembre> findActiveByGroupe(
            @Param("agenceId") Long agenceId,
            @Param("groupeId") Long groupeId,
            @Param("date") LocalDate date
    );

    @Query("""
            select membre
            from GroupeClientMembre membre
            where membre.groupe.id = :groupeId
              and membre.client.id = :clientId
              and membre.dateFin is null
            order by membre.dateDebut desc
            """)
    List<GroupeClientMembre> findOpenMemberships(
            @Param("groupeId") Long groupeId,
            @Param("clientId") Long clientId
    );

    @Query("""
            select membre
            from GroupeClientMembre membre
            where membre.groupe.id = :groupeId
              and membre.client.id = :clientId
              and membre.dateDebut <= :date
              and (membre.dateFin is null or membre.dateFin > :date)
            """)
    Optional<GroupeClientMembre> findActiveMembership(
            @Param("groupeId") Long groupeId,
            @Param("clientId") Long clientId,
            @Param("date") LocalDate date
    );
}
