package com.assurance.repository;

import com.assurance.entity.Vehicule;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Collection;
import java.util.Optional;

public interface VehiculeRepository extends JpaRepository<Vehicule, Long> {
    void deleteByContratId(Long contratId);

    List<Vehicule> findByContratIdOrderByCreatedAtAsc(Long contratId);

    List<Vehicule> findByContratIdInOrderByCreatedAtAsc(Collection<Long> contratIds);

    @Query("""
            select v
            from Vehicule v
            where v.contrat.id = :contratId
              and (v.actif is null or v.actif = true)
            order by v.createdAt asc
            """)
    @EntityGraph(attributePaths = "marque")
    List<Vehicule> findActiveByContratIdOrderByCreatedAtAsc(@Param("contratId") Long contratId);

    List<Vehicule> findByContratIdAndIdIn(Long contratId, List<Long> ids);

    Optional<Vehicule> findFirstByContratAgenceIdAndImmatriculationIgnoreCaseOrderByCreatedAtDesc(Long agenceId, String immatriculation);
}
