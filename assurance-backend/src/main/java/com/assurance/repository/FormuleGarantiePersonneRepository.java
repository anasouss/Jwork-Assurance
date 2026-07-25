package com.assurance.repository;

import com.assurance.entity.FormuleGarantiePersonne;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface FormuleGarantiePersonneRepository extends JpaRepository<FormuleGarantiePersonne, String> {
    List<FormuleGarantiePersonne> findByGrilleTarifaireIdAndUsageIdAndGarantieIdAndActifTrueOrderByOrdreAffichageAscFormuleAsc(
            String grilleTarifaireId,
            String usageId,
            String garantieId
    );
}
