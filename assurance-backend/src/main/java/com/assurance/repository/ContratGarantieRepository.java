package com.assurance.repository;

import com.assurance.entity.ContratGarantie;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ContratGarantieRepository extends JpaRepository<ContratGarantie, Long> {
    void deleteByContratId(Long contratId);

    void deleteByContratIdAndVehiculeId(Long contratId, Long vehiculeId);

    void deleteByContratIdAndRemorqueId(Long contratId, Long remorqueId);

    List<ContratGarantie> findByContratIdOrderByCreatedAtAsc(Long contratId);

    @Query("""
            select g
            from ContratGarantie g
            where g.contrat.id = :contratId
              and (g.actif is null or g.actif = true)
            """)
    List<ContratGarantie> findActiveByContratId(@Param("contratId") Long contratId);
}
