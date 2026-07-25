package com.assurance.repository;

import com.assurance.entity.GrilleTarifaire;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface GrilleTarifaireRepository extends JpaRepository<GrilleTarifaire, String> {
    List<GrilleTarifaire> findByCompagnieAssuranceIdAndActifTrueOrderByCreatedAtDesc(String compagnieAssuranceId);

    List<GrilleTarifaire> findByCompagnieAssuranceIdAndActifTrueOrderByLibelleAsc(String compagnieAssuranceId);
}
