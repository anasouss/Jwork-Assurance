package com.assurance.repository;

import com.assurance.entity.ReglementClient;
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

public interface ReglementClientRepository extends JpaRepository<ReglementClient, Long> {

    @EntityGraph(attributePaths = {"clientPayeur", "groupePayeur", "creePar", "instruments", "instruments.compteTresorerie"})
    @Query("""
            select distinct r
            from ReglementClient r
            where r.agence.id = :agenceId
              and (:dateDu is null or r.dateReglement >= :dateDu)
              and (:dateAu is null or r.dateReglement <= :dateAu)
              and (:search is null
                   or lower(r.numero) like concat('%', :search, '%')
                   or lower(r.payeurNom) like concat('%', :search, '%'))
            """)
    Page<ReglementClient> search(
            @Param("agenceId") Long agenceId,
            @Param("dateDu") LocalDate dateDu,
            @Param("dateAu") LocalDate dateAu,
            @Param("search") String search,
            Pageable pageable
    );

    @EntityGraph(attributePaths = {
            "clientPayeur", "groupePayeur", "creePar", "instruments",
            "instruments.compteTresorerie", "instruments.affectations",
            "instruments.affectations.elementFacturable"
    })
    Optional<ReglementClient> findByIdAndAgenceId(Long id, Long agenceId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {
            "clientPayeur", "groupePayeur", "creePar", "instruments",
            "instruments.compteTresorerie", "instruments.affectations",
            "instruments.affectations.elementFacturable",
            "instruments.affectations.documentClient"
    })
    @Query("""
            select payment
            from ReglementClient payment
            where payment.id = :id
              and payment.agence.id = :agenceId
            """)
    Optional<ReglementClient> findByIdAndAgenceIdForUpdate(
            @Param("id") Long id,
            @Param("agenceId") Long agenceId
    );
}
