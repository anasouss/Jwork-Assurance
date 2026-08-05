package com.assurance.repository;

import com.assurance.entity.ProvisionSinistre;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import com.assurance.enums.StatutSinistre;

public interface ProvisionSinistreRepository extends JpaRepository<ProvisionSinistre, Long> {

    @EntityGraph(attributePaths = "saisiePar")
    List<ProvisionSinistre> findBySinistreIdOrderByDateProvisionDescCreatedAtDesc(Long sinistreId);

    Optional<ProvisionSinistre> findFirstBySinistreIdOrderByDateProvisionDescCreatedAtDesc(Long sinistreId);

    @Query("""
            select coalesce(sum(p.montant), 0)
            from ProvisionSinistre p
            where p.sinistre.agence.id = :agenceId
              and p.sinistre.statut in :statuts
              and not exists (
                  select newer.id
                  from ProvisionSinistre newer
                  where newer.sinistre = p.sinistre
                    and (
                      newer.dateProvision > p.dateProvision
                      or (newer.dateProvision = p.dateProvision and newer.createdAt > p.createdAt)
                    )
              )
            """)
    BigDecimal totalCurrentByAgencyAndStatuses(
            @Param("agenceId") Long agenceId,
            @Param("statuts") Collection<StatutSinistre> statuts
    );
}
