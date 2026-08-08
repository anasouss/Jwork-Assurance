package com.assurance.repository;

import com.assurance.entity.SinistreOperation;
import com.assurance.enums.TypeOperationSinistre;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

public interface SinistreOperationRepository extends JpaRepository<SinistreOperation, Long> {

    @EntityGraph(attributePaths = {
            "saisiPar",
            "operationAnnulee",
            "compagnieAssurance",
            "contrepartieClient",
            "contrepartiePartie",
            "contrepartieExpert",
            "contrepartieGarage"
    })
    List<SinistreOperation> findBySinistreIdOrderByDateOperationDescCreatedAtDesc(Long sinistreId);

    Optional<SinistreOperation> findByIdAndSinistreId(Long id, Long sinistreId);

    boolean existsByOperationAnnuleeId(Long operationId);

    boolean existsByContrepartiePartieId(Long partieId);

    @Query("""
            select coalesce(sum(o.montant), 0)
            from SinistreOperation o
            where o.sinistre.id = :sinistreId
              and o.type = :type
              and not exists (
                  select cancellation.id
                  from SinistreOperation cancellation
                  where cancellation.operationAnnulee = o
              )
            """)
    BigDecimal totalByType(
            @Param("sinistreId") Long sinistreId,
            @Param("type") TypeOperationSinistre type
    );

    @Query("""
            select coalesce(sum(o.montant), 0)
            from SinistreOperation o
            where o.sinistre.agence.id = :agenceId
              and o.type = :type
              and o.dateOperation between :dateDu and :dateAu
              and not exists (
                  select cancellation.id
                  from SinistreOperation cancellation
                  where cancellation.operationAnnulee = o
              )
            """)
    BigDecimal totalActiveByAgencyAndTypeAndDateBetween(
            @Param("agenceId") Long agenceId,
            @Param("type") TypeOperationSinistre type,
            @Param("dateDu") java.time.LocalDate dateDu,
            @Param("dateAu") java.time.LocalDate dateAu
    );
}
