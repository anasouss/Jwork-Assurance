package com.assurance.repository;

import com.assurance.entity.Sinistre;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

public interface ClientPortalClaimCandidateRepository extends Repository<Sinistre, Long> {
    @EntityGraph(attributePaths = {"contrat"})
    @Query("""
            select s from Sinistre s where s.agence.id = :agency
              and s.statut <> com.assurance.enums.StatutSinistre.BROUILLON
              and (s.client.id = :client or s.contrat.payeurPrime.id = :client or exists (
                  select cc.id from ContratClient cc where cc.contrat = s.contrat and cc.client.id = :client
              ))
              and (:query = '' or lower(s.numeroSinistre) like lower(concat('%', :query, '%'))
                   or lower(coalesce(s.contrat.numeroPolice, '')) like lower(concat('%', :query, '%')))
            order by s.id desc
            """)
    Page<Sinistre> findCandidates(@Param("agency") Long agency, @Param("client") Long client,
                                  @Param("query") String query, Pageable pageable);
}
