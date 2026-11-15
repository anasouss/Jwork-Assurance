package com.assurance.repository;

import com.assurance.entity.AssistanceContrat;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface ClientPortalAssistanceRepository extends org.springframework.data.repository.Repository<AssistanceContrat, Long> {
    @EntityGraph(attributePaths = {"compagnieAssistance", "vehicule"})
    @Query("select a from AssistanceContrat a where a.contrat.id = :contract and a.contrat.agence.id = :agency and a.actif = true order by a.id")
    Page<AssistanceContrat> findForContract(@Param("agency") Long agency, @Param("contract") Long contract, Pageable pageable);
}
