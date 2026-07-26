package com.assurance.repository;

import com.assurance.entity.GrilleTarifaire;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface GrilleTarifaireRepository extends JpaRepository<GrilleTarifaire, Long> {
    @EntityGraph(attributePaths = "compagnieAssurance")
    List<GrilleTarifaire> findAllByOrderByCreatedAtDesc();

    @EntityGraph(attributePaths = "compagnieAssurance")
    List<GrilleTarifaire> findByCompagnieAssuranceIdAndActifTrueOrderByCreatedAtDesc(Long compagnieAssuranceId);

    @EntityGraph(attributePaths = "compagnieAssurance")
    List<GrilleTarifaire> findByCompagnieAssuranceIdAndActifTrueOrderByLibelleAsc(Long compagnieAssuranceId);
}
