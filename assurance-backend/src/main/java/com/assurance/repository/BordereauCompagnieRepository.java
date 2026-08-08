package com.assurance.repository;

import com.assurance.entity.BordereauCompagnie;
import com.assurance.enums.StatutBordereauCompagnie;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface BordereauCompagnieRepository extends JpaRepository<BordereauCompagnie, Long> {

    @EntityGraph(attributePaths = {"compagnieAssurance", "creePar", "validePar"})
    @Query("""
            select b
            from BordereauCompagnie b
            where b.agence.id = :agenceId
              and (:compagnieId is null or b.compagnieAssurance.id = :compagnieId)
              and (:statut is null or b.statut = :statut)
              and (:dateDu is null or b.periodeFin >= :dateDu)
              and (:dateAu is null or b.periodeDebut <= :dateAu)
              and (
                    :search is null
                    or lower(b.numero) like concat('%', :search, '%')
                    or lower(b.compagnieAssurance.nom) like concat('%', :search, '%')
                    or lower(coalesce(b.referenceTransmission, '')) like concat('%', :search, '%')
              )
            order by b.createdAt desc, b.id desc
            """)
    Page<BordereauCompagnie> search(
            @Param("agenceId") Long agenceId,
            @Param("compagnieId") Long compagnieId,
            @Param("statut") StatutBordereauCompagnie statut,
            @Param("dateDu") LocalDate dateDu,
            @Param("dateAu") LocalDate dateAu,
            @Param("search") String search,
            Pageable pageable
    );

    @EntityGraph(attributePaths = {
            "compagnieAssurance",
            "creePar",
            "validePar",
            "lignes",
            "lignes.affectationSource"
    })
    Optional<BordereauCompagnie> findByIdAndAgenceId(Long id, Long agenceId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select b from BordereauCompagnie b where b.id = :id and b.agence.id = :agenceId")
    Optional<BordereauCompagnie> lockByIdAndAgenceId(@Param("id") Long id, @Param("agenceId") Long agenceId);

    List<BordereauCompagnie> findByIdInAndAgenceId(Collection<Long> ids, Long agenceId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select b
            from BordereauCompagnie b
            where b.agence.id = :agenceId and b.id in :ids
            order by b.id asc
            """)
    List<BordereauCompagnie> lockByAgenceIdAndIdIn(
            @Param("agenceId") Long agenceId,
            @Param("ids") Collection<Long> ids
    );
}
