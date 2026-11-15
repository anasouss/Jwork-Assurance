package com.assurance.repository;

import com.assurance.entity.Contrat;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

public interface ClientPortalContractCandidateRepository extends Repository<Contrat, Long> {
    @Query("""
            select c from Contrat c where c.agence.id = :agency
              and c.brouillon = false and c.prospection = false
              and (c.payeurPrime.id = :client or exists (
                  select cc.id from ContratClient cc where cc.contrat = c and cc.client.id = :client
              ))
              and (:query = '' or lower(coalesce(c.numeroPolice, '')) like lower(concat('%', :query, '%'))
                   or lower(coalesce(c.numeroDossier, '')) like lower(concat('%', :query, '%')))
            order by c.id desc
            """)
    Page<Contrat> findCandidates(@Param("agency") Long agency, @Param("client") Long client,
                                 @Param("query") String query, Pageable pageable);
}
