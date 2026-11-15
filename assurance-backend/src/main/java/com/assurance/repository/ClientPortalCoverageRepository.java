package com.assurance.repository;

import com.assurance.entity.ContratGarantie;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface ClientPortalCoverageRepository extends org.springframework.data.repository.Repository<ContratGarantie, Long> {
    @EntityGraph(attributePaths = {"garantie", "vehicule", "remorque"})
    @Query("select g from ContratGarantie g left join g.vehicule v left join g.remorque r where g.contrat.id = :contract and g.contrat.agence.id = :agency"
            + " and (g.actif = true or g.actif is null) and (v.id is null or v.actif = true or v.actif is null)"
            + " and (r.id is null or r.actif = true or r.actif is null) order by g.id")
    Page<ContratGarantie> findForContract(@Param("agency") Long agency, @Param("contract") Long contract, Pageable pageable);
}
