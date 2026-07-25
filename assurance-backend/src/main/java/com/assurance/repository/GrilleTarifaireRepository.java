package com.assurance.repository;

import com.assurance.entity.GrilleTarifaire;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface GrilleTarifaireRepository extends JpaRepository<GrilleTarifaire, String> {
    @EntityGraph(attributePaths = "compagnieAssurance")
    List<GrilleTarifaire> findAllByOrderByCreatedAtDesc();

    @EntityGraph(attributePaths = "compagnieAssurance")
    List<GrilleTarifaire> findByCompagnieAssuranceIdAndActifTrueOrderByCreatedAtDesc(String compagnieAssuranceId);

    @EntityGraph(attributePaths = "compagnieAssurance")
    List<GrilleTarifaire> findByCompagnieAssuranceIdAndActifTrueOrderByLibelleAsc(String compagnieAssuranceId);
}
