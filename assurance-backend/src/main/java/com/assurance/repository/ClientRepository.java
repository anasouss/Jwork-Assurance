package com.assurance.repository;

import com.assurance.entity.Client;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ClientRepository extends JpaRepository<Client, Long> {
    long countByAgenceIdAndActifTrue(Long agenceId);

    Optional<Client> findByAgenceIdAndId(Long agenceId, Long id);
    Optional<Client> findFirstByAgenceIdAndCinIgnoreCase(Long agenceId, String cin);
    Optional<Client> findFirstByAgenceIdAndRcIgnoreCase(Long agenceId, String rc);
    List<Client> findByAgenceIdAndClientParentId(Long agenceId, Long clientParentId);

    @Query("""
            select client
            from Client client
            where client.agence.id = :agenceId
              and (
                    :query is null
                    or lower(coalesce(client.raisonSociale, '')) like lower(concat('%', :query, '%'))
                    or lower(coalesce(client.nom, '')) like lower(concat('%', :query, '%'))
                    or lower(coalesce(client.prenom, '')) like lower(concat('%', :query, '%'))
                    or lower(coalesce(client.codeClient, '')) like lower(concat('%', :query, '%'))
                    or lower(coalesce(client.cin, '')) like lower(concat('%', :query, '%'))
                    or lower(coalesce(client.rc, '')) like lower(concat('%', :query, '%'))
                    or lower(coalesce(client.ice, '')) like lower(concat('%', :query, '%'))
              )
              and (
                    :groupeId is null
                    or exists (
                        select membre.id
                        from GroupeClientMembre membre
                        where membre.client = client
                          and membre.groupe.id = :groupeId
                          and membre.dateDebut <= current_date
                          and (membre.dateFin is null or membre.dateFin > current_date)
                    )
              )
            order by coalesce(client.raisonSociale, client.nom), client.prenom
            """)
    Page<Client> searchCrm(
            @Param("agenceId") Long agenceId,
            @Param("query") String query,
            @Param("groupeId") Long groupeId,
            Pageable pageable
    );
}
