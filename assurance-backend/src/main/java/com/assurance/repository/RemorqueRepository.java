package com.assurance.repository;

import com.assurance.entity.Remorque;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface RemorqueRepository extends JpaRepository<Remorque, Long> {
    void deleteByContratId(Long contratId);

    List<Remorque> findByContratIdOrderByCreatedAtAsc(Long contratId);

    @Query("""
            select r
            from Remorque r
            where r.contrat.id = :contratId
              and (r.actif is null or r.actif = true)
            order by r.createdAt asc
            """)
    List<Remorque> findActiveByContratIdOrderByCreatedAtAsc(@Param("contratId") Long contratId);

    List<Remorque> findByContratIdAndIdIn(Long contratId, List<Long> ids);
}
