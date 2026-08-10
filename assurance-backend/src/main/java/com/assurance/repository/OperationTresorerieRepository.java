package com.assurance.repository;

import com.assurance.entity.OperationTresorerie;
import com.assurance.enums.TypeOperationTresorerie;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Optional;

public interface OperationTresorerieRepository extends JpaRepository<OperationTresorerie, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {"compteSource", "compteDestination", "confirmeePar", "operationExtournee"})
    Optional<OperationTresorerie> findByIdAndAgenceId(Long id, Long agenceId);

    boolean existsByAgenceIdAndOperationExtourneeId(Long agenceId, Long operationId);

    @EntityGraph(attributePaths = {"compteSource", "compteDestination", "confirmeePar", "operationExtournee"})
    @Query("""
            select o from OperationTresorerie o
            left join o.compteSource source
            left join o.compteDestination destination
            where o.agence.id = :agenceId
              and (source.id in :comptesVisibles or destination.id in :comptesVisibles)
              and (:compteId is null or source.id = :compteId or destination.id = :compteId)
              and (:type is null or o.typeOperation = :type)
              and (:dateDu is null or o.dateOperation >= :dateDu)
              and (:dateAu is null or o.dateOperation <= :dateAu)
              and (:search is null
                   or lower(o.numero) like concat('%', :search, '%')
                   or lower(coalesce(o.reference, '')) like concat('%', :search, '%')
                   or lower(o.motif) like concat('%', :search, '%'))
            order by o.dateOperation desc, o.id desc
            """)
    Page<OperationTresorerie> search(
            @Param("agenceId") Long agenceId,
            @Param("comptesVisibles") java.util.Collection<Long> comptesVisibles,
            @Param("compteId") Long compteId,
            @Param("type") TypeOperationTresorerie type,
            @Param("dateDu") LocalDate dateDu,
            @Param("dateAu") LocalDate dateAu,
            @Param("search") String search,
            Pageable pageable
    );
}
