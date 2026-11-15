package com.assurance.repository;

import com.assurance.entity.Vehicule;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface ClientPortalVehicleRepository extends org.springframework.data.repository.Repository<Vehicule, Long> {
    @EntityGraph(attributePaths = {"marque"})
    @Query("select v from Vehicule v where v.contrat.id = :contract and v.contrat.agence.id = :agency and (v.actif = true or v.actif is null) order by v.id")
    Page<Vehicule> findForContract(@Param("agency") Long agency, @Param("contract") Long contract, Pageable pageable);
}
